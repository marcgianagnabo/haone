import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { LS_KEYS } from "$lib/constants";
import { auth } from "$state/auth.svelte";

/** Idle time after which the session is signed out. */
export const SESSION_TIMEOUT_MS = 15 * 60 * 1000;

const CHECK_INTERVAL_MS = 30 * 1000;
const WRITE_THROTTLE_MS = 5 * 1000;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;

class SessionTimeout {
  private interval: ReturnType<typeof setInterval> | null = null;
  private memoryActivity = 0;
  private lastWrite = 0;
  private started = false;

  private readLastActivity(): number {
    if (this.memoryActivity > 0) {
      return this.memoryActivity;
    }
    if (!browser) {
      return 0;
    }
    try {
      const raw = localStorage.getItem(LS_KEYS.SESSION_LAST_ACTIVITY);
      const at = raw ? Number(raw) : NaN;
      if (!Number.isNaN(at) && at > 0) {
        return at;
      }
    } catch {
      // ignore
    }
    return 0;
  }

  /** Stamp the current time as the last user activity. */
  recordActivity() {
    if (!browser) {
      return;
    }
    const now = Date.now();
    this.memoryActivity = now;
    // Throttle storage writes; cross-tab sync only needs coarse freshness.
    if (now - this.lastWrite < WRITE_THROTTLE_MS) {
      return;
    }
    this.lastWrite = now;
    try {
      localStorage.setItem(LS_KEYS.SESSION_LAST_ACTIVITY, String(now));
    } catch {
      // ignore (e.g. private mode) — memory timestamp still applies
    }
  }

  private check = () => {
    if (!auth.accessToken) {
      return;
    }
    let last = this.readLastActivity();
    if (!last) {
      // No stamp yet (e.g. restored session on fresh load): start the clock now
      // instead of signing out immediately.
      this.recordActivity();
      return;
    }
    if (Date.now() - last >= SESSION_TIMEOUT_MS) {
      auth.signOutWithMessage(
        "Signed out due to inactivity",
        "You were signed out after 15 minutes of inactivity. Please sign in again."
      );
      goto("/sign-in");
    }
  };

  private handleActivity = () => {
    if (auth.accessToken) {
      this.recordActivity();
    }
  };

  private handleStorage = (e: StorageEvent) => {
    if (e.key === LS_KEYS.SESSION_LAST_ACTIVITY && e.newValue) {
      const at = Number(e.newValue);
      if (!Number.isNaN(at) && at > this.memoryActivity) {
        this.memoryActivity = at;
      }
    }
  };

  private handleVisibility = () => {
    if (document.visibilityState === "visible") {
      this.check();
    }
  };

  init() {
    if (!browser || this.started) {
      return;
    }
    this.started = true;
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, this.handleActivity, { passive: true });
    }
    window.addEventListener("storage", this.handleStorage);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.interval = setInterval(this.check, CHECK_INTERVAL_MS);
  }

  destroy() {
    if (!browser || !this.started) {
      return;
    }
    this.started = false;
    for (const name of ACTIVITY_EVENTS) {
      window.removeEventListener(name, this.handleActivity);
    }
    window.removeEventListener("storage", this.handleStorage);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export const sessionTimeout = new SessionTimeout();
