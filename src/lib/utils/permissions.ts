/**
 * Officer capability checks.
 *
 * These mirror the rule the server already enforces in `authenticateAdmin`
 * (src/lib/api/services/auth-service.ts) — an active officer in the
 * `officers` table / `directory` sheet — and the matching Supabase RLS
 * policies `constants_write` / `journal_write`, which are both gated on
 * `is_officer()`.
 *
 * They exist as a UI-layer fast fail so a resident session that reaches an
 * admin surface by direct URL is turned away before any dispatch is staged
 * or any constant is written. They are NOT a security boundary: the
 * authoritative checks are the RLS policies and the credential JWT.
 */

import { auth } from "$state/auth.svelte";

/** True only for a signed-in House Council officer session. */
export function isOfficerSession(): boolean {
  return !!auth.accessToken && auth.authType === "admin" && !auth.isResident;
}

/** Settling a journal row and dispatching its acknowledgement receipt. */
export function canSendReceipts(): boolean {
  return isOfficerSession();
}

/** Creating, editing and activating academic terms and their fee schedules. */
export function canManageAcademicTerms(): boolean {
  return isOfficerSession();
}
