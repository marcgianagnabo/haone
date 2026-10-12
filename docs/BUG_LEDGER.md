# Bug Ledger

A running record of significant production incidents: symptoms, evidence,
root causes, fixes, and verification. Newest entries first.

---

## 2026-10-12 — Post-sign-in error boundary on iPhone Safari

**Status:** Fixed by `411157b` (`master` + `production`). Verified working on 1 of
4 affected iPhones; observability retained for the remaining confirmations.

**Scope:** `https://haone-nfrh.pages.dev` (Cloudflare Pages, no custom domain).
All iPhone models 11–17 (iOS Safari / WebKit, incl. Messenger in-app browser).
Windows and Android unaffected throughout.

### Symptom timeline (with evidence)

1. `Missing PKCE verifier` after Google OAuth bounce on iPhone Safari, while
   desktop/Chrome worked. (`client-auth-service.ts` stored the PKCE verifier in
   `sessionStorage` only, which WebKit drops on the cross-origin bounce.)
2. Stackless `404` (`Path: /resident`, no Technical Details) on the current
   build — ruled out as an app-thrown 404 (none exists on the login path) and
   as an edge 404 (`GET /resident`, `/onboarding`, `/sign-in/workspace` all
   probed live → `200`).
3. `500 "Internal Error"`, no stack, `Path: /resident`, minutes after landing
   (e.g. login `10:46:01–10:46:12`, flip `10:57:25`). Login itself proven
   healthy by the device report:
   `signin_start → code_seen → pkce:session → token:200 → goto:/resident`.
   Standby-correlated: failures followed idle/background periods on all 4
   phones. Edge request logs showed the boundary rendering with no outbound
   request at flip time (pure client-side event).

### Root causes fixed

- PKCE verifier lost on WebKit OAuth bounce (`sessionStorage`-only).
- SvelteKit client-router navigation right after the cross-origin bounce
  failing on WebKit (stackless boundary over the destination URL).
- Root layout background syncs (`features.load()`, `settings.syncFromServer()`)
  fired un-awaited — a `try/catch` around a non-awaited promise catches nothing,
  so a suspended-then-killed iOS fetch rejected straight into the boundary.
- Workspace-picker handoff kept in memory only (wiped by the full-page
  post-login navigation this incident introduced).

### Fix chain (all on `master` + `production`)

- `3938e0b` — PKCE triple-persist (session + local + cookie), state nonce,
  single-use codes, sanitized `goto` targets, dialog-only callback errors,
  defensive session storage.
- `d6abfda` — Full-page `location.assign` post-login navigation; auth
  breadcrumb trail; enriched error Copy output.
- `da3212e` — Persisted workspace-picker handoff; render gate on the picker.
- `b6dceb0` — `POST /api/client-log` error beacon; always-visible failing
  path + Copy; Retry query-strip; picker/onboarding full-page hops;
  one-shot stale-chunk reload recovery.
- `ca0ac68` — Trail on timeout + all layout-guard redirects; visible
  screenshot-friendly error report; last-error persistence surfaced on
  `/sign-in`; apple-touch-icon links.
- `411157b` — Awaited root background syncs in real `try/catch` (trailed);
  `fetchServer` trails every non-OK/rejection; pre-sanitize raw-error
  capture shown in report and sign-in surface.

### Mechanism notes (for future reference)

- SvelteKit client `load_data` (`@sveltejs/kit/src/runtime/client/client.js`)
  throws `HttpError(500, 'Internal Error')` for non-JSON 500 responses; server
  `get_message` (`utils/error.js`) yields the same text for non-SvelteKit
  errors. Either produces exactly `500 / "Internal Error" / no stack`.
- `auth.signOut()` calls `localStorage.clear()`, which also wipes the auth
  trail — an intact login trail therefore proves no sign-out/timeout ran
  before the flip.
- Free-plan Cloudflare has no Workers-log retention: the beacon POST 200s at
  the edge (`httpRequestsAdaptive`) but its body is only readable via live
  tail during a repro. On-device visible report + `/sign-in` last-error
  surface are the retention-independent evidence channels.

### Verification

- 2026-10-12: first affected iPhone retested OK after `411157b` deployed.
- Remaining: confirm on the other 3 iPhones (new-resident onboarding +
  onboarded-resident login). If any still flips, its on-page report
  (`Raw:` / `sync:` / `api:` lines) dictates the follow-up.
