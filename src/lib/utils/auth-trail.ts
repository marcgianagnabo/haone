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
  /** Full ISO timestamp — dateless stamps made stale entries ambiguous. */
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
    entries.push({ t: new Date().toISOString(), e: event.slice(0, 80) });
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

const BOUNDARY_MARK_KEY = "halsk.boundary_mount_at";
const BOUNDARY_RELOAD_KEY = "halsk.boundary_reloaded";

/**
 * Records an error-boundary mount and reports whether this is a repeat
 * occurrence inside {@link windowMs}. Distinguishes a single, fully reportable
 * failure from a flip-loop that needs a one-shot heal. Uses two separate keys
 * so the heal flag can never corrupt the interval detection.
 */
export function markBoundaryMount(windowMs = 60_000): "first" | "repeat" {
  try {
    const prev = Number(sessionStorage.getItem(BOUNDARY_MARK_KEY));
    const now = Date.now();
    sessionStorage.setItem(BOUNDARY_MARK_KEY, String(now));
    return Number.isFinite(prev) && prev > 0 && now - prev < windowMs ? "repeat" : "first";
  } catch {
    return "first";
  }
}

/** True when a loop-heal reload already ran, so another reload can't fire. */
export function consumeReloadMark(): boolean {
  try {
    if (sessionStorage.getItem(BOUNDARY_RELOAD_KEY) === "1") {
      sessionStorage.removeItem(BOUNDARY_RELOAD_KEY);
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function setReloadedMark(): void {
  try {
    sessionStorage.setItem(BOUNDARY_RELOAD_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

const GUARD_REDIRECT_KEY = "halsk.guard_redirect";

/**
 * Navigation guards live in reactive effects, so a burst of dependencies can
 * fire overlapping `goto()` calls for the same destination. Those overlapping
 * navigations race SvelteKit's router and can surface as a sanitized, stackless
 * 500. Suppressing a repeat redirect to the same target inside `gapMs` removes
 * that race fuel. Returns false when the call should be skipped.
 */
export function shouldRedirect(target: string, gapMs = 1000): boolean {
  try {
    const raw = sessionStorage.getItem(GUARD_REDIRECT_KEY);
    sessionStorage.setItem(GUARD_REDIRECT_KEY, JSON.stringify({ t: target, at: Date.now() }));
    if (!raw) return true;
    const prev = JSON.parse(raw);
    return !(prev?.t === target && Date.now() - Number(prev?.at || 0) < gapMs);
  } catch {
    // Storage unavailable: allow the redirect rather than stranding the user.
    return true;
  }
}
