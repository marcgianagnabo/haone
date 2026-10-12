import { clientAuthService } from "$api/services/client-auth-service";
import { browser } from "$app/environment";
import { LS_KEYS } from "$lib/constants";
import type { UserRecord } from "$lib/types";
import { globalDialog } from "$state/dialog.svelte";

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
      try {
        const savedToken = localStorage.getItem(LS_KEYS.ACCESS_TOKEN);
        const savedCredentialJwt = localStorage.getItem(LS_KEYS.CREDENTIAL_JWT);
        const savedUser = localStorage.getItem(LS_KEYS.USER);
        const remembered = localStorage.getItem(LS_KEYS.REMEMBER) === "true";

        if (remembered && savedToken && savedCredentialJwt && savedUser) {
          this.accessToken = savedToken;
          this.credentialJwt = savedCredentialJwt;
          try {
            this.user = JSON.parse(savedUser);
          } catch {
            this.user = null;
          }
          this.isRemembered = true;
          this.avatarUrl = localStorage.getItem(LS_KEYS.CACHED_PICTURE);
          this.authType = (localStorage.getItem(LS_KEYS.AUTH_TYPE) as "admin" | "resident") || null;
          this.isInstanceAdmin = localStorage.getItem(LS_KEYS.IS_ADMIN) === "true";
        }
        // Workspace handoff survives the full-page post-login navigation so
        // the picker still shows after the reload that fixes WebKit 404s.
        try {
          if (localStorage.getItem(LS_KEYS.WORKSPACE_REQUIRED) === "1") {
            this.workspaceChoiceRequired = true;
            this.pendingWorkspaceTarget =
              localStorage.getItem(LS_KEYS.WORKSPACE_TARGET) || "/resident";
          }
        } catch {
          /* persistence unavailable */
        }
      } catch {
        // Storage unavailable (Private mode / locked webview): start signed out.
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
        /* persistence unavailable; session continues in memory */
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
        try {
          localStorage.setItem(LS_KEYS.WORKSPACE_REQUIRED, "1");
          localStorage.setItem(LS_KEYS.WORKSPACE_TARGET, pendingTarget);
        } catch {
          /* persistence unavailable; in-memory handoff still works pre-reload */
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
    }
  }
}

export const auth = new AuthState();
