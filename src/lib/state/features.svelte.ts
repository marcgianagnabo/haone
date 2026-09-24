import { constantsService } from "$api/services/constants-service";

/**
 * DB-backed feature flags. The value is read from the `constants` table so it
 * can be flipped at runtime (e.g. via the Database Sync page) without a
 * redeploy, while defaulting to "enabled" when the constant is absent.
 */
export const FEATURE_ACHIEVEMENTS_ENABLED = "FEATURE_ACHIEVEMENTS_ENABLED";

const FALSY_VALUES = new Set(["false", "0", "no", "off", "disabled", ""]);

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) {
    return fallback;
  }
  return !FALSY_VALUES.has(value.trim().toLowerCase());
}

class Features {
  #achievementsEnabled = $state<boolean>(true);
  #loaded = false;

  get achievementsEnabled() {
    return this.#achievementsEnabled;
  }

  /**
   * Loads the feature flags once. Idempotent; safe to call from every page.
   */
  async load(): Promise<void> {
    if (this.#loaded) {
      return;
    }
    this.#loaded = true;
    try {
      const value = await constantsService.fetchConstantByKey(FEATURE_ACHIEVEMENTS_ENABLED);
      this.#achievementsEnabled = parseBoolean(value, true);
    } catch (e) {
      console.error("[Features] failed to load feature flags:", e);
    }
  }
}

export const features = new Features();