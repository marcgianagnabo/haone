import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Receives client-side error beacons from +error.svelte so failures on
 * devices we can't touch (iPhone Safari / in-app webviews) still arrive in
 * the Cloudflare logs. Deliberately unauthenticated (the error page may be
 * signed-out) and PII-free: path (pathname only, never query), status,
 * build, coarse auth trail, and user agent. Bodies are length-capped.
 */
function cap(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const status = Number(body?.status) || 0;
    const path = cap(body?.path, 200);
    const build = cap(body?.build, 100);
    const trail = cap(body?.trail, 1000);
    const ua = cap(request.headers.get("user-agent"), 300);
    console.error(
      `[client-error] status=${status} path=${path} build=${build} ua=${ua} trail=${trail}`
    );
  } catch (e) {
    console.error("[client-error] malformed beacon");
  }
  return json({ ok: true });
};
