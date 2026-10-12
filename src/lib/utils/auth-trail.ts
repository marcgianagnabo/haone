/**
 * Auth breadcrumb trail — tiny ring buffer (last 20 events) persisted to
 * localStorage so a pasted error report shows exactly where a sign-in died,
 * even on devices we can't touch (iPhone Safari / in-app webviews).
 *
 * Never stores secrets: only coarse step names, HTTP statuses and target
 * paths. Query strings (which may contain single-use OAuth codes) are never
 * recorded.
 */

const TRAIL_KEY = "halsk.auth.trail";
const TRAIL_MAX = 20;

interface TrailEntry {
  t: string;
  e: string;
}

function readEntries(): TrailEntry[] {
  try {
    const raw = localStorage.getItem(TRAIL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Append one breadcrumb. No-op outside the browser or when storage is blocked. */
export function authTrail(event: string): void {
  try {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }
    const entries = readEntries();
    const now = new Date();
    const t = now.toTimeString().slice(0, 8);
    entries.push({ t, e: event.slice(0, 80) });
    while (entries.length > TRAIL_MAX) {
      entries.shift();
    }
    localStorage.setItem(TRAIL_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable — diagnostics are best-effort */
  }
}

/** One-line summary for pasting into error reports. */
export function readAuthTrail(): string {
  try {
    const entries = readEntries();
    if (entries.length === 0) return "(empty)";
    return entries.map((en) => `${en.e} ${en.t}`).join(" → ");
  } catch {
    return "(unavailable)";
  }
}
