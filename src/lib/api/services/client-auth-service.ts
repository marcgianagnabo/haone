import { resolveUserIdByEmail, supabase } from "$api/services/common";
import { settingsService } from "$api/services/settings-service";
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { PUBLIC_DB_PROVIDER, PUBLIC_GI_CLIENT_ID } from "$env/static/public";
import type { AuthExchangeResult, TokenExchangeResponse, UserRecord } from "$lib/types";
import { generatePKCEChallenge, generatePKCEVerifier } from "$utils/crypto";

const PKCE_LOCAL_KEY = "halsk.auth.pkce";
const PKCE_COOKIE = "ha_pkce";
const PKCE_TTL_MS = 10 * 60 * 1000;
// Targets the app is allowed to navigate to after sign-in. Anything else
// falls back to the role default so a mangled `state` param can never push
// SvelteKit to an unknown route (which renders +error.svelte 404).
const SAFE_TARGETS = ["/resident", "/admin", "/onboarding", "/sign-in/workspace", "/sign-in", "/"];

function safeGetLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode / locked webview: keep in-memory session, skip persistence.
  }
}

function safeRemoveLS(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function safeGetSS(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetSS(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

function safeRemoveSS(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
  } catch {
    /* cookies unavailable in some webviews */
  }
}

function getCookie(name: string): string | null {
  try {
    const parts = document.cookie.split("; ");
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      if (part.slice(0, eq) === name) {
        return decodeURIComponent(part.slice(eq + 1));
      }
    }
    return null;
  } catch {
    return null;
  }
}

function deleteCookie(name: string): void {
  try {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* noop */
  }
}

interface PersistedPKCE {
  verifier: string;
  type: "admin" | "resident";
  nonce: string;
  exp: number;
}

function generateNonce(): string {
  try {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e9).toString(36)}`;
  }
}

function persistPKCE(verifier: string, type: "admin" | "resident", nonce: string): void {
  const payload: PersistedPKCE = { verifier, type, nonce, exp: Date.now() + PKCE_TTL_MS };
  const raw = JSON.stringify(payload);
  // sessionStorage first (legacy readers), then localStorage (survives iOS
  // Safari tab discard / OAuth bounce), then cookie (in-app webview fallback).
  safeSetSS("pkce_verifier", verifier);
  safeSetSS("pkce_auth_type", type);
  safeSetLS(PKCE_LOCAL_KEY, raw);
  setCookie(PKCE_COOKIE, raw, 600);
}

function readPKCE(): { record: PersistedPKCE; source: "session" | "local" | "cookie" } | null {
  // Legacy session shape (pre-nonce deploys still in flight).
  const ssVerifier = safeGetSS("pkce_verifier");
  if (ssVerifier) {
    const ssType = (safeGetSS("pkce_auth_type") as "admin" | "resident") || "resident";
    const localRaw = safeGetLS(PKCE_LOCAL_KEY);
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw) as PersistedPKCE;
        if (parsed.verifier === ssVerifier && parsed.exp > Date.now()) {
          return { record: parsed, source: "session" };
        }
      } catch {
        /* fall through to legacy shape */
      }
    }
    // Legacy record without nonce: accept once, migrate callers to new shape.
    return {
      record: { verifier: ssVerifier, type: ssType, nonce: "", exp: Date.now() + PKCE_TTL_MS },
      source: "session"
    };
  }

  const localRaw = safeGetLS(PKCE_LOCAL_KEY);
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw) as PersistedPKCE;
      if (parsed.verifier && parsed.exp > Date.now()) {
        return { record: parsed, source: "local" };
      }
    } catch {
      /* corrupted payload */
    }
  }

  const cookieRaw = getCookie(PKCE_COOKIE);
  if (cookieRaw) {
    try {
      const parsed = JSON.parse(cookieRaw) as PersistedPKCE;
      if (parsed.verifier && parsed.exp > Date.now()) {
        return { record: parsed, source: "cookie" };
      }
    } catch {
      /* corrupted payload */
    }
  }

  return null;
}

function clearPKCE(): void {
  safeRemoveSS("pkce_verifier");
  safeRemoveSS("pkce_auth_type");
  safeRemoveLS(PKCE_LOCAL_KEY);
  deleteCookie(PKCE_COOKIE);
}

function sanitizeTarget(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  const target = raw.trim();
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//")) return fallback;
  if (target.includes("\\") || target.includes("\n") || target.includes("\r")) return fallback;
  if (SAFE_TARGETS.some((p) => target === p || target.startsWith(p + "/") || p === "/" && target === "/")) {
    return target;
  }
  // Allow "/" exactly; otherwise fall back so we never goto() an unknown route.
  return fallback;
}

async function safeGoto(target: string): Promise<void> {
  try {
    await goto(target);
  } catch {
    // SvelteKit client navigation can reject on WebKit after an OAuth bounce.
    window.location.assign(target);
  }
}

/**
 * Initiates Google OAuth sign-in flow.
 *
 * The spreadsheets scope is only requested for legacy Sheets-backend
 * installs (it probes workbook access with the user's own token).
 * Supabase installs skip it; gmail.send stays (officer mail sending).
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
    // Legacy Sheets-backend installs verify workbook access with the user's
    // own token; Supabase installs never touch Sheets as the user.
    ...(PUBLIC_DB_PROVIDER === "sheets" ? ["https://www.googleapis.com/auth/spreadsheets"] : [])
  ];

  const scopes = (type === "admin" ? adminScopes : residentScopes).join(" ");

  const verifier = generatePKCEVerifier();
  const nonce = generateNonce();
  persistPKCE(verifier, type, nonce);
  const challenge = await generatePKCEChallenge(verifier);

  const defaultTarget = type === "admin" ? "/admin" : "/resident";
  const rawTarget = redirectTo || defaultTarget;
  const safeTarget = sanitizeTarget(rawTarget, defaultTarget);
  // Nonce is embedded so the callback can prove the ?code= belongs to the
  // PKCE verifier stored in this browser (iOS Safari / in-app webviews often
  // lose sessionStorage on the Google bounce; local + cookie survive).
  const state = `${nonce}.${safeTarget}`;

  const params = new URLSearchParams({
    client_id: PUBLIC_GI_CLIENT_ID,
    redirect_uri: window.location.origin + "/sign-in",
    response_type: "code",
    scope: scopes,
    state,
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

  if (!code) {
    return null;
  }

  // Strip single-use query params immediately so a reload / double-mount can
  // never replay the same code (Google rejects replays with invalid_grant).
  try {
    window.history.replaceState({}, "", window.location.pathname);
  } catch {
    /* noop */
  }

  const stored = readPKCE();
  if (!stored) {
    throw new Error("Sign-in session expired in this browser. Please tap Sign In again.");
  }
  const { record, source } = stored;
  const savedType = record.type || "resident";
  const verifier = record.verifier;
  if (!verifier) {
    clearPKCE();
    throw new Error("Sign-in session expired in this browser. Please tap Sign In again.");
  }

  // Validate the state nonce when present. Legacy states (pre-nonce deploys,
  // just "/resident" or "/admin") skip the check once for backwards compat.
  let stateTarget: string | null = null;
  if (state) {
    const dot = state.indexOf(".");
    if (dot > 0) {
      const nonceFromState = state.slice(0, dot);
      stateTarget = state.slice(dot + 1) || null;
      if (record.nonce && nonceFromState !== record.nonce) {
        clearPKCE();
        throw new Error("Sign-in session expired in this browser. Please tap Sign In again.");
      }
    } else {
      stateTarget = state;
    }
  }
  if (record.exp <= Date.now()) {
    clearPKCE();
    throw new Error("Sign-in session expired in this browser. Please tap Sign In again.");
  }
  if (source === "local" || source === "cookie") {
    console.info(`[auth] PKCE verifier recovered from ${source} (sessionStorage was lost)`);
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
    let err: any = {};
    try {
      err = await tokenResp.json();
    } catch {
      /* non-JSON error body */
    }
    const desc: string = err.error_description || err.error || "Token exchange failed";
    // Single-use codes rejected on replay (double-mount, reload, back-button)
    // surface as invalid_grant — translate to an actionable message.
    if (/invalid_grant|already.*redeem|expired/i.test(desc)) {
      clearPKCE();
      throw new Error("This sign-in link was already used or expired. Please tap Sign In again.");
    }
    throw new Error(desc);
  }

  const { tokenData, user, isInstanceAdmin, credentialJwt } =
    (await tokenResp.json()) as TokenExchangeResponse;

  clearPKCE();

  const fallbackTarget = savedType === "admin" ? "/admin" : "/resident";
  let target = sanitizeTarget(stateTarget || state, fallbackTarget);
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
  /**
   * Invoked instead of the final navigation when a fresh officer/admin
   * sign-in should pause on the workspace picker. Receives the pending
   * resident target for the Resident View choice.
   */
  onWorkspaceRequired?: (pendingTarget: string) => void;
}

/**
 * Resolves whether the login email belongs to an officer. Best-effort and
 * fail-closed (false): it only gates the workspace picker, never admin
 * access itself, which stays enforced server-side.
 */
export async function resolveOfficerRole(email: string): Promise<boolean> {
  try {
    if (!email) {
      return false;
    }
    if (PUBLIC_DB_PROVIDER === "supabase") {
      if (!supabase) {
        return false;
      }
      const { data, error } = await supabase
        .from("officers")
        .select("id")
        .ilike("email", email)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (error) {
        return false;
      }
      return !!data;
    }
    const { fetchServer } = await import("$utils/api-client");
    const res = await fetchServer<{ isOfficer?: boolean }>("/api/auth/role", {}, true);
    return res?.isOfficer === true;
  } catch {
    return false;
  }
}

/**
 * Handles OAuth callback workflow.
 */
export async function handleCallback(options: CallbackOptions): Promise<boolean> {
  if (!browser) {
    return false;
  }

  const {
    accessToken,
    authType,
    redirectTo,
    rememberMe = true,
    onSession,
    onSignOut,
    onWorkspaceRequired
  } = options;

  if (accessToken && !window.location.search.includes("code=")) {
    const fallback = authType === "admin" ? "/admin" : "/resident";
    const target = sanitizeTarget(redirectTo, fallback);
    await safeGoto(target);
    return true;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");

  if (!code) {
    if (accessToken) {
      const fallback = authType === "admin" ? "/admin" : "/resident";
      let target = sanitizeTarget(redirectTo, fallback);
      if (authType === "resident" && target.startsWith("/admin")) {
        target = "/resident";
      }
      await safeGoto(target);
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

  // Officers and instance admins choose a workspace after sign-in instead of
  // dropping straight into Resident View. Residents skip this entirely.
  if (savedType === "resident" && onWorkspaceRequired) {
    const isOfficer = isInstanceAdmin || (await resolveOfficerRole(user.email));
    if (isOfficer) {
      let pendingTarget = sanitizeTarget(redirectTo || exchangeTarget, "/resident");
      if (pendingTarget.startsWith("/admin")) {
        pendingTarget = "/resident";
      }
      onWorkspaceRequired(pendingTarget);
      await safeGoto("/sign-in/workspace");
      return true;
    }
  }

  if (savedType === "admin") {
    await settingsService.verifyAccess(newAccessToken);
  }

  let finalTarget = sanitizeTarget(redirectTo || exchangeTarget, exchangeTarget);
  if (savedType === "resident" && finalTarget.startsWith("/admin")) {
    finalTarget = "/resident";
  }
  await safeGoto(finalTarget);
  return true;
}

export const clientAuthService = {
  signIn,
  handleCallback
};
