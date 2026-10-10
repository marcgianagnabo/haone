/**
 * Canonical student number format: XXXX-XXXXX (dash after the 4th digit),
 * e.g. 202512069 -> 2025-12069.
 *
 * Non-numeric identifiers (e.g. TRANSIENT/BOOTCAMP auto-generated
 * `TYPE-TERM-uuid` values) are returned trimmed and untouched.
 */

export function normalizeStudentNo(value: string | null | undefined): string {
  const raw = (value || "").trim();
  if (!raw) {
    return "";
  }
  const digits = raw.replace(/[^0-9]/g, "");
  // Only pure-numeric values get the dash; anything with letters is a
  // temporary/system identifier and must be preserved exactly.
  if (!digits || digits.length !== raw.replace(/[\s-]/g, "").length) {
    return raw;
  }
  if (digits.length <= 4) {
    return digits;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

/**
 * Live-typing mask for student number inputs. Idempotent: re-applying it to
 * an already-masked value is a no-op, so it is caret-safe (it only ever
 * inserts a single `-` after the 4th digit).
 */
export function maskStudentNoInput(value: string | null | undefined): string {
  return normalizeStudentNo(value);
}

/**
 * Candidate variants of a student number for lookups that must bridge the
 * pre-mask era (undashed stored values) and the canonical dashed form:
 * [canonical, digits-only, raw-trimmed], deduplicated.
 */
export function studentNoVariants(value: string | null | undefined): string[] {
  const raw = (value || "").trim();
  if (!raw) {
    return [];
  }
  const out: string[] = [];
  for (const v of [normalizeStudentNo(raw), raw.replace(/[^0-9]/g, ""), raw]) {
    if (v && !out.includes(v)) {
      out.push(v);
    }
  }
  return out;
}

/**
 * Cross-format equality: true when the typed input matches the stored value
 * in any equivalent representation (canonical dashed, digits-only, or exact).
 * Used by receipt/clearance verification so records stored before the dash
 * convention still verify with masked input, and vice versa.
 */
export function matchesStudentNo(
  input: string | null | undefined,
  stored: string | null | undefined
): boolean {
  const s = (stored || "").trim();
  if (!s) {
    return false;
  }
  if ((input || "").trim() === s) {
    return true;
  }
  return studentNoVariants(input).includes(normalizeStudentNo(s));
}
