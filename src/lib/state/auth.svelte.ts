import { clientAuthService } from "$api/services/client-auth-service";
import { browser } from "$app/environment";
import { LS_KEYS } from "$lib/constants";
import type { UserRecord } from "$lib/types";
import { globalDialog } from "$state/dialog.svelte";
import { authTrail } from "$utils/auth-trail";

class AuthState {
  accessToken = $state<string | null>(null);
  credentialJwt = $state<string | null>(null);
  user = $state<UserRecord | null>(null);
  isRemembered = $state(false);
  redirectTo = $state<string | null>(null);
  initialized = $state(false);
  avatarUrl = $state<string | null>(null);
  authType = $state<"admin" | "resident" | null>(null);
  isInstanceAdmin = $state(false);
  workspaceChoiceRequired = $state(false);
  pendingWorkspaceTarget: string | null = $state(null);

  get userId(): string {
    return this.user?.id || "";
  }

  get displayNameLastFirst(): string {
    return this.user?.displayName || "";
  }

  get displayName(): string {
    return this.user?.displayNameFormal || "";
  }

  get preferredName(): string {
    return this.user?.overrideName || this.user?.firstName || "";
  }

  get isResident(): boolean {
    if (this.authType === "resident") {
      return true;
    }
    if (browser && window.location.pathname.startsWith("/resident")) {
      return true;
    }
    if (this.authType !== "admin") {
      return true;
    }
    return false;
  }

  constructor() {
    if (browser) {
      let savedToken: string | null = null;
      let savedCredentialJwt: string | null = null;
      let savedUser: string | null = null;
      let remembered = false;
      let storage: Storage | null = null;
      let tabStorage: Storage | null = null;

      try {
        storage = localStorage;
      } catch {
        /* Safari Private Mode / locked webviews may deny localStorage. */
      }
      try {
        tabStorage = sessionStorage;
      } catch {
        /* sessionStorage may also be unavailable in restricted webviews. */
      }

      const readSession = (store: Storage | null) => {
        if (!store) return null;
        try {
          const token = store.getItem(LS_KEYS.ACCESS_TOKEN);
          const credentialJwt = store.getItem(LS_KEYS.CREDENTIAL_JWT);
          const user = store.getItem(LS_KEYS.USER);
          const shouldRemember = store.getItem(LS_KEYS.REMEMBER) === "true";
          return token && credentialJwt && user && shouldRemember
            ? { token, credentialJwt, user, store }
            : null;
        } catch {
          return null;
        }
      };

      const storedSession = readSession(storage) || readSession(tabStorage);
      if (storedSession) {
        authTrail(`session:restore:${storedSession.store === tabStorage ? "session" : "local"}`);
        savedToken = storedSession.token;
        savedCredentialJwt = storedSession.credentialJwt;
        savedUser = storedSession.user;
        remembered = true;
      } else {
        authTrail("session:restore:none");
      }

      if (remembered && savedToken && savedCredentialJwt && savedUser) {
        this.accessToken = savedToken;
        this.credentialJwt = savedCredentialJwt;
        try {
          this.user = JSON.parse(savedUser);
        } catch {
          this.user = null;
        }
        this.isRemembered = true;
        try {
          this.avatarUrl = storedSession?.store.getItem(LS_KEYS.CACHED_PICTURE) || null;
          this.authType =
            (storedSession?.store.getItem(LS_KEYS.AUTH_TYPE) as "admin" | "resident") || null;
          this.isInstanceAdmin = storedSession?.store.getItem(LS_KEYS.IS_ADMIN) === "true";
        } catch {
          /* optional cached values */
        }
      }

      // Persist the workspace handoff in the same fallback store as the
      // session so it survives the full-page OAuth handoff in restricted Safari.
      for (const store of [storage, tabStorage]) {
        if (!store) continue;
        try {
          if (store.getItem(LS_KEYS.WORKSPACE_REQUIRED) === "1") {
            this.workspaceChoiceRequired = true;
            this.pendingWorkspaceTarget = store.getItem(LS_KEYS.WORKSPACE_TARGET) || "/resident";
            break;
          }
        } catch {
          /* storage unavailable */
        }
      }
      this.initialized = true;
    }
  }

  async fetchAvatarUrl() {
    if (!browser || this.avatarUrl || this.user?.avatarUrl === undefined) {
      return;
    }

    try {
      const response = await fetch(this.user.avatarUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        this.avatarUrl = base64data;
        if (this.isRemembered) {
          try {
            localStorage.setItem(LS_KEYS.CACHED_PICTURE, base64data);
          } catch {
            /* persistence unavailable */
          }
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to cache profile picture:", e);
    }
  }

  setSession(
    token: string,
    remember: boolean,
    user: UserRecord,
    type: "admin" | "resident",
    isInstanceAdmin: boolean = false,
    credentialJwt: string
  ) {
    this.accessToken = token;
    this.credentialJwt = credentialJwt;
    this.user = user;

    // A new session means a different identity; drop cached sheet/server data
    // so the previous user's data is never served. Every dynamic import and
    // promise is guarded: a suspended/failed fetch (iOS kills standby sockets)
    // must never escape as an unhandled rejection.
    if (browser) {
      import("$api/services/common")
        .then(({ invalidateCache }) => {
          invalidateCache();
        })
        .catch(() => {});
      import("$utils/api-client")
        .then(({ invalidateServerCache }) => {
          invalidateServerCache();
        })
        .catch(() => {});
    }

    this.isRemembered = remember;
    this.authType = type;
    this.isInstanceAdmin = isInstanceAdmin;

    if (browser && remember) {
      // Persistence is best-effort: in-memory session above is authoritative
      // so immediate navigation still sees auth.accessToken even when
      // localStorage throws (Safari Private / locked in-app webview).
      try {
        localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
        localStorage.setItem(LS_KEYS.CREDENTIAL_JWT, this.credentialJwt);
        localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(LS_KEYS.REMEMBER, "true");
        localStorage.setItem(LS_KEYS.AUTH_TYPE, type);
        localStorage.setItem(LS_KEYS.IS_ADMIN, String(isInstanceAdmin));
      } catch {
        // Full-page post-login navigation clears memory. Keep a tab-scoped
        // fallback so the session can be restored when localStorage is blocked.
        try {
          sessionStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
          sessionStorage.setItem(LS_KEYS.CREDENTIAL_JWT, this.credentialJwt);
          sessionStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
          sessionStorage.setItem(LS_KEYS.REMEMBER, "true");
          sessionStorage.setItem(LS_KEYS.AUTH_TYPE, type);
          sessionStorage.setItem(LS_KEYS.IS_ADMIN, String(isInstanceAdmin));
        } catch {
          /* both persistence mechanisms unavailable */
        }
      }
      this.fetchAvatarUrl();
    }

    // Best-effort: fill the officer directory auto-photo from the Gmail
    // picture (Supabase backend; the token endpoint owns the Sheets path).
    // Only an officer session can write under RLS; anything else resolves
    // silently inside fillAutoPhoto.
    if (browser && user.avatarUrl && user.email) {
      const avatarUrl = user.avatarUrl;
      const email = user.email;
      import("$api/services/common")
        .then(({ isSupabase }) => {
          if (!isSupabase) {
            return;
          }
          return import("$api/services/officer-service")
            .then(({ officerService }) => officerService.fillAutoPhoto(email, avatarUrl))
            .catch(() => {});
        })
        .catch(() => {});
    }
  }

  signOut() {
    this.accessToken = null;
    this.credentialJwt = null;
    this.user = null;
    this.isRemembered = false;
    this.workspaceChoiceRequired = false;
    this.pendingWorkspaceTarget = null;

    if (browser) {
      import("$api/services/common")
        .then(({ supabase, invalidateCache }) => {
          invalidateCache();
          // Floating promise: guard so a rejected sign-out (aborted by iOS on
          // suspend) can't become an unhandled rejection.
          return supabase ? supabase.auth.signOut() : undefined;
        })
        .catch(() => {});
      import("$utils/api-client")
        .then(({ invalidateServerCache }) => {
          invalidateServerCache();
        })
        .catch(() => {});
      try {
        localStorage.clear();
      } catch {
        /* noop */
      }
      for (const key of [
        LS_KEYS.ACCESS_TOKEN,
        LS_KEYS.CREDENTIAL_JWT,
        LS_KEYS.USER,
        LS_KEYS.REMEMBER,
        LS_KEYS.CACHED_PICTURE,
        LS_KEYS.AUTH_TYPE,
        LS_KEYS.IS_ADMIN,
        LS_KEYS.WORKSPACE_REQUIRED,
        LS_KEYS.WORKSPACE_TARGET
      ]) {
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* noop */
        }
      }
      this.avatarUrl = null;
      this.authType = null;
      this.isInstanceAdmin = false;
    }

    // Per-session admin state must not survive a sign-out.
    import("$state/sync-count.svelte").then(({ syncCount }) => syncCount.reset()).catch(() => {});
  }

  signOutWithMessage(title: string, description: string) {
    this.signOut();
    globalDialog.show(title, description);
  }

  async signIn(type: "admin" | "resident"): Promise<void> {
    return clientAuthService.signIn(type, this.redirectTo);
  }

  async handleCallback(rememberMe = true): Promise<boolean> {
    const success = await clientAuthService.handleCallback({
      accessToken: this.accessToken,
      authType: this.authType,
      redirectTo: this.redirectTo,
      rememberMe,
      onSession: (token, remember, user, type, isInstanceAdmin, credentialJwt) => {
        this.setSession(token, remember, user, type, isInstanceAdmin, credentialJwt);
      },
      onSignOut: () => {
        this.signOut();
      },
      onWorkspaceRequired: (pendingTarget) => {
        this.workspaceChoiceRequired = true;
        this.pendingWorkspaceTarget = pendingTarget;
        let saved = false;
        try {
          localStorage.setItem(LS_KEYS.WORKSPACE_REQUIRED, "1");
          localStorage.setItem(LS_KEYS.WORKSPACE_TARGET, pendingTarget);
          saved = true;
        } catch {
          /* try tab-scoped persistence below */
        }
        if (!saved) {
          try {
            sessionStorage.setItem(LS_KEYS.WORKSPACE_REQUIRED, "1");
            sessionStorage.setItem(LS_KEYS.WORKSPACE_TARGET, pendingTarget);
          } catch {
            /* persistence unavailable */
          }
        }
      }
    });

    if (success) {
      this.redirectTo = null;
    }

    return success;
  }

  clearWorkspaceChoice() {
    this.workspaceChoiceRequired = false;
    this.pendingWorkspaceTarget = null;
    if (browser) {
      try {
        localStorage.removeItem(LS_KEYS.WORKSPACE_REQUIRED);
        localStorage.removeItem(LS_KEYS.WORKSPACE_TARGET);
      } catch {
        /* noop */
      }
      try {
        sessionStorage.removeItem(LS_KEYS.WORKSPACE_REQUIRED);
        sessionStorage.removeItem(LS_KEYS.WORKSPACE_TARGET);
      } catch {
        /* noop */
      }
    }
  }
}

export const auth = new AuthState();
