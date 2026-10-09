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
          localStorage.setItem(LS_KEYS.CACHED_PICTURE, base64data);
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
    // so the previous user's data is never served.
    if (browser) {
      import("$api/services/common").then(({ invalidateCache }) => {
        invalidateCache();
      });
      import("$utils/api-client").then(({ invalidateServerCache }) => {
        invalidateServerCache();
      });
    }

    this.isRemembered = remember;
    this.authType = type;
    this.isInstanceAdmin = isInstanceAdmin;

    if (browser && remember) {
      localStorage.setItem(LS_KEYS.ACCESS_TOKEN, token);
      localStorage.setItem(LS_KEYS.CREDENTIAL_JWT, this.credentialJwt);
      localStorage.setItem(LS_KEYS.USER, JSON.stringify(user));
      localStorage.setItem(LS_KEYS.REMEMBER, "true");
      localStorage.setItem(LS_KEYS.AUTH_TYPE, type);
      localStorage.setItem(LS_KEYS.IS_ADMIN, String(isInstanceAdmin));
      this.fetchAvatarUrl();
    }

    // Best-effort: fill the officer directory auto-photo from the Gmail
    // picture (Supabase backend; the token endpoint owns the Sheets path).
    // Only an officer session can write under RLS; anything else resolves
    // silently inside fillAutoPhoto.
    if (browser && user.avatarUrl && user.email) {
      const avatarUrl = user.avatarUrl;
      const email = user.email;
      import("$api/services/common").then(({ isSupabase }) => {
        if (!isSupabase) {
          return;
        }
        import("$api/services/officer-service").then(({ officerService }) => {
          officerService.fillAutoPhoto(email, avatarUrl).catch(() => {});
        });
      });
    }
  }

  signOut() {
    this.accessToken = null;
    this.credentialJwt = null;
    this.user = null;
    this.isRemembered = false;

    if (browser) {
      import("$api/services/common").then(({ supabase, invalidateCache }) => {
        invalidateCache();
        if (supabase) {
          supabase.auth.signOut();
        }
      });
      import("$utils/api-client").then(({ invalidateServerCache }) => {
        invalidateServerCache();
      });
      localStorage.clear();
      this.avatarUrl = null;
      this.authType = null;
      this.isInstanceAdmin = false;
    }
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
      }
    });

    if (success) {
      this.redirectTo = null;
    }

    return success;
  }
}

export const auth = new AuthState();
