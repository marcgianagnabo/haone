import { auth } from "$state/auth.svelte";
import { authTrail } from "$utils/auth-trail";

let serverCache: Record<string, any> = {};

/**
 * Clears the server API data cache.
 */
export function invalidateServerCache() {
  serverCache = {};
}

/**
 * Unified fetch wrapper for server API calls.
 * Automatically injects auth token and handles 401 unauthorized errors.
 * Includes session-based caching.
 */
export async function fetchServer<T = any>(
  url: string,
  options: RequestInit = {},
  bypassCache = false
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const isGet = method === "GET";

  if (isGet && !bypassCache && serverCache[url]) {
    return serverCache[url] as T;
  }

  const headers = new Headers(options.headers || {});
  if (auth.credentialJwt) {
    headers.set("Authorization", `Bearer ${auth.credentialJwt}`);
  }

  // Strip query (may hold ids) — trail endpoint path + outcome only.
  const trailPath = url.split("?")[0].slice(0, 60);
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (e: any) {
    authTrail(`api:${trailPath}:network:${(e?.message || "failed").slice(0, 40)}`);
    throw e;
  }

  if (response.status === 401) {
    auth.signOutWithMessage("Session Expired", "Your session has expired. Please sign in again.");
    throw new Error("Your session has expired. Please sign in again.");
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg =
      (typeof data?.message === "string" ? data.message : null) ||
      (typeof data?.error === "string" ? data.error : null) ||
      `Server error: ${response.statusText}`;
    authTrail(`api:${trailPath}:${response.status}`);
    throw new Error(errorMsg);
  }

  if (isGet) {
    serverCache[url] = data;
  } else {
    // Invalidate client GET cache upon any mutating request
    serverCache = {};
  }

  return data as T;
}
