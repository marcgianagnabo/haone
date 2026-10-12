import { settings } from "$state/settings.svelte";

/**
 * Pending-registration count for the Residents → Sync tab badge.
 *
 * The count lives here rather than in the tab bar because the tab bar is
 * rendered by every Residents page (List/Rooms/Officers/Sync) while the data
 * is only loaded by the sync page itself. Keeping it in shared state lets the
 * sync page publish its own count for free and lets the other pages show the
 * badge without each one repeating the (uncached) preview fetch.
 */
class SyncCountState {
  count = $state(0);
  /** Has a fetch been attempted this session? Guards duplicate loads. */
  loaded = $state(false);
  isLoading = $state(false);

  /**
   * Loads the count once per session. Safe to call from anywhere: it no-ops
   * when already loaded, while loading, or when the active term has not
   * arrived yet (callers should retry once `settings.activeTerm` changes).
   */
  async load(): Promise<void> {
    if (this.loaded || this.isLoading) {
      return;
    }
    const term = (settings.activeTerm || "").trim();
    if (!term) {
      return;
    }

    this.isLoading = true;
    try {
      const { getSyncPreview } = await import("$api/controllers/rooms-controller.svelte");
      const actions = await getSyncPreview(term);
      // Group by resident (currIndex) to match the page's own "residents
      // pending" count rather than counting individual actions.
      const groups = new Set<number>();
      for (const action of actions) {
        groups.add(action.currIndex ?? -1);
      }
      this.count = groups.size;
    } catch {
      // The badge is supplementary; never surface its failures.
      this.count = 0;
    } finally {
      this.loaded = true;
      this.isLoading = false;
    }
  }

  /** Publish a count computed elsewhere (the sync page's own preview). */
  set(count: number): void {
    this.count = Math.max(0, count || 0);
    this.loaded = true;
  }

  /** Called on sign-out so a later session starts clean. */
  reset(): void {
    this.count = 0;
    this.loaded = false;
    this.isLoading = false;
  }
}

export const syncCount = new SyncCountState();
