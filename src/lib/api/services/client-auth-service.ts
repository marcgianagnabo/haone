import { resolveUserIdByEmail, supabase } from "$api/services/common";
import { settingsService } from "$api/services/settings-service";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { PUBLIC_DB_PROVIDER, PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type { AuthExchangeResult, TokenExchangeResponse, UserRecord } from "$lib/types";
import { generatePKCEChallenge, generatePKCEVerifier } from "$utils/crypto";

/**
 * Initiates Google OAuth sign-in flow.
 */
export async function signIn(
  type: "admin" | "resident",
  redirectTo?: string | null
): Promise<void> {
  if (!browser) {
    return;
  }

  const residentScopes = ["openid", "profile", "email"];

  const adminScopes = [
    ...residentScopes,
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/spreadsheets"
  ];

  const scopes = (type === "admin" ? adminScopes : residentScopes).join(" ");

  const verifier = generatePKCEVerifier();
  sessionStorage.setItem("pkce_verifier", verifier);
  sessionStorage.setItem("pkce_auth_type", type);
  const challenge = await generatePKCEChallenge(verifier);

  const params = new URLSearchParams({
    client_id: PUBLIC_GI_CLIENT_ID,
    redirect_uri: window.location.origin + "/sign-in",
    response_type: "code",
    scope: scopes,
    state: redirectTo || (type === "admin" ? "/admin" : "/resident"),
    include_granted_scopes: "true",
    code_challenge: challenge,
    code_challenge_method: "S256"
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges auth code for tokens and validates with backend.
 */
async function exchangeAuthCode(): Promise<AuthExchangeResult | null> {
  if (!browser) {
    return null;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const state = urlParams.get("state");
  const savedType =
    (sessionStorage.getItem("pkce_auth_type") as "admin" | "resident") || "resident";

  if (!code) {
    return null;
  }

  const verifier = sessionStorage.getItem("pkce_verifier");
  if (!verifier) {
    throw new Error("Missing PKCE verifier");
  }

  const tokenResp = await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri: window.location.origin + "/sign-in"
    })
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.json();
    throw new Error(err.error_description || "Token exchange failed");
  }

  const { tokenData, user, isInstanceAdmin, credentialJwt } =
    (await tokenResp.json()) as TokenExchangeResponse;

  sessionStorage.removeItem("pkce_verifier");
  sessionStorage.removeItem("pkce_auth_type");

  let target = state || (savedType === "admin" ? "/admin" : "/resident");
  if (savedType === "resident" && target.startsWith("/admin")) {
    target = "/resident";
  }

  return {
    tokenData,
    user,
    isInstanceAdmin,
    credentialJwt,
    savedType,
    target
  };
}

export interface CallbackOptions {
  accessToken: string | null;
  authType: "admin" | "resident" | null;
  redirectTo: string | null;
  rememberMe?: boolean;
  onSession: (
    token: string,
    remember: boolean,
    user: UserRecord,
    type: "admin" | "resident",
    isInstanceAdmin: boolean,
    credentialJwt: string
  ) => void;
  onSignOut: () => void;
}

/**
 * Handles OAuth callback workflow.
 */
export async function handleCallback(options: CallbackOptions): Promise<boolean> {
  if (!browser) {
    return false;
  }

  const { accessToken, authType, redirectTo, rememberMe = true, onSession, onSignOut } = options;

  if (accessToken && !window.location.search.includes("code=")) {
    const target = redirectTo || (authType === "admin" ? "/admin" : "/resident");
    await goto(target);
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (!code) {
    if (accessToken) {
      let target = redirectTo || (authType === "admin" ? "/admin" : "/resident");
      if (authType === "resident" && target.startsWith("/admin")) {
        target = "/resident";
      }
      await goto(target);
      return true;
    }
    return false;
  }

  const exchangeResult = await exchangeAuthCode();
  if (!exchangeResult) {
    return false;
  }

  const {
    tokenData,
    user,
    isInstanceAdmin,
    credentialJwt,
    savedType,
    target: exchangeTarget
  } = exchangeResult;
  const { access_token: newAccessToken, id_token: idToken } = tokenData;

  if (PUBLIC_DB_PROVIDER === "supabase") {
    if (!supabase || !idToken) {
      throw new Error("Supabase sign-in is not configured (missing Supabase client or ID token).");
    }
    const { error: sbErr } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken
    });
    if (sbErr) {
      onSignOut();
      throw new Error(`Supabase sign-in failed: ${sbErr.message}`);
    }
    // The token endpoint resolves identities with an unauthenticated client, so
    // it can mint a placeholder id. Resolve the real public.users id from the
    // authenticated session and persist it so resident pages keyed on
    // auth.userId match the ids stored on their rows.
    const resolvedId = await resolveUserIdByEmail(user.email);
    if (resolvedId) {
      user.id = resolvedId;
    }
  }

  onSession(newAccessToken, rememberMe, user, savedType, isInstanceAdmin, credentialJwt);

  if (savedType === "admin") {
    await settingsService.verifyAccess(newAccessToken);
  }

  let finalTarget = redirectTo || exchangeTarget;
  if (savedType === "resident" && finalTarget.startsWith("/admin")) {
    finalTarget = "/resident";
  }
  await goto(finalTarget);
  return true;
}

export const clientAuthService = {
  signIn,
  handleCallback
};
