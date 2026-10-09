import { fetchUserSettings, updateUserSettings } from "$api/controllers/settings-controller";
import { browser, dev } from "$app/environment";
import {
  PUBLIC_APP_ENV,
  PUBLIC_APP_FIREBASE_ENABLED,
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_GS_SR_ID
} from "$env/static/public";
import { LS_KEYS } from "$lib/constants";
import { auth } from "$state/auth.svelte";

export type UIFont = "default" | "archivo" | "shantell";
export type DisplayDensity = "default" | "compact" | "comfortable";

class Settings {
  #fontFamily = $state<UIFont>("default");
  #reducedMotion = $state(false);
  #displayDensity = $state<DisplayDensity>("default");
  #theme = $state<string>("system");
  #isPublicAchievementList = $state(true);
  #residentNavIds = $state<string[]>(["home", "finance", "laundry"]);
  #adminNavIds = $state<string[]>(["dashboard", "history", "residents", "officers"]);
  #clockFormat = $state<"12h" | "24h">("12h");
  #calendarView = $state<"month" | "week" | "day" | "history">("week");
  #showAllTimeAchievements = $state(true);

  #currentTerm = $state<string>("");
  activeTerm = $state<string>("");
  #accountingWorkbookId = $state<string>(PUBLIC_GS_AW_ID || "");
  #residentRecordsId = $state<string>(PUBLIC_GS_RR_ID || "");
  #sharedRecordsId = $state<string>(PUBLIC_GS_SR_ID || "");

  constructor() {
    if (browser) {
      this.#fontFamily = (localStorage.getItem(LS_KEYS.UI_FONT) as UIFont) || "default";
      this.#reducedMotion = localStorage.getItem(LS_KEYS.ACC_REDUCED_MOTION) === "true";
      this.#currentTerm = localStorage.getItem(LS_KEYS.UI_CURRENT_TERM) || "";
      const sga = localStorage.getItem(LS_KEYS.UI_SHOW_ALL_TIME_ACHIEVEMENTS);
      this.#showAllTimeAchievements = sga === null ? true : sga === "true";
      this.#displayDensity =
        (localStorage.getItem(LS_KEYS.ACC_SPACIOUS_LAYOUT) as DisplayDensity) || "default";
      this.#theme = localStorage.getItem(LS_KEYS.UI_THEME) || "system";
      this.#accountingWorkbookId = localStorage.getItem(LS_KEYS.GS_AW_ID) || PUBLIC_GS_AW_ID || "";
      this.#residentRecordsId = localStorage.getItem(LS_KEYS.GS_RR_ID) || PUBLIC_GS_RR_ID || "";
      this.#sharedRecordsId = localStorage.getItem(LS_KEYS.GS_SR_ID) || PUBLIC_GS_SR_ID || "";
      this.#clockFormat = (localStorage.getItem(LS_KEYS.UI_CLOCK_FORMAT) as "12h" | "24h") || "12h";
      this.#calendarView =
        (localStorage.getItem(LS_KEYS.UI_CALENDAR_VIEW) as "month" | "week" | "day" | "history") ||
        "week";

      const spa = localStorage.getItem(LS_KEYS.UI_IS_PUBLIC_ACHIEVEMENTS);
      this.#isPublicAchievementList = spa === null ? true : spa === "true";
      const sn = localStorage.getItem(LS_KEYS.UI_NAV_RESIDENT);
      if (sn) {
        this.#residentNavIds = JSON.parse(sn);
      }
      const an = localStorage.getItem(LS_KEYS.UI_NAV_ADMIN);
      if (an) {
        this.#adminNavIds = JSON.parse(an);
      }
    }
  }

  // Getters/Setters for UI (with localStorage sync as cache)
  get fontFamily() {
    return this.#fontFamily;
  }
  set fontFamily(v: UIFont) {
    this.#fontFamily = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_FONT, v);
    }
    this.scheduleAutoSave();
  }

  get reducedMotion() {
    return this.#reducedMotion;
  }
  set reducedMotion(v: boolean) {
    this.#reducedMotion = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.ACC_REDUCED_MOTION, String(v));
    }
    this.scheduleAutoSave();
  }

  get displayDensity() {
    return this.#displayDensity;
  }
  set displayDensity(v: DisplayDensity) {
    this.#displayDensity = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.ACC_SPACIOUS_LAYOUT, v);
    }
    this.scheduleAutoSave();
  }

  get theme() {
    return this.#theme;
  }
  set theme(v: string) {
    this.#theme = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_THEME, v);
    }
    this.scheduleAutoSave();
  }

  get isPublicAchievementList() {
    // Privacy toggle removed: earner names are always shown.
    return true;
  }
  set isPublicAchievementList(_v: boolean) {
    this.#isPublicAchievementList = true;
  }

  get residentNavIds() {
    return this.#residentNavIds;
  }
  set residentNavIds(v: string[]) {
    this.#residentNavIds = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_NAV_RESIDENT, JSON.stringify(v));
    }
    this.scheduleAutoSave();
  }

  get adminNavIds() {
    return this.#adminNavIds;
  }
  set adminNavIds(v: string[]) {
    this.#adminNavIds = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_NAV_ADMIN, JSON.stringify(v));
    }
    this.scheduleAutoSave();
  }

  get clockFormat() {
    return this.#clockFormat;
  }
  set clockFormat(v: "12h" | "24h") {
    this.#clockFormat = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_CLOCK_FORMAT, v);
    }
    this.scheduleAutoSave();
  }

  get calendarView() {
    return this.#calendarView;
  }
  set calendarView(v: "month" | "week" | "day" | "history") {
    this.#calendarView = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_CALENDAR_VIEW, v);
    }
    this.scheduleAutoSave();
  }

  get showAllTimeAchievements() {
    return this.#showAllTimeAchievements;
  }
  set showAllTimeAchievements(v: boolean) {
    this.#showAllTimeAchievements = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_SHOW_ALL_TIME_ACHIEVEMENTS, String(v));
    }
  }

  get currentTerm() {
    return this.#currentTerm;
  }
  set currentTerm(v: string) {
    this.#currentTerm = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.UI_CURRENT_TERM, v);
    }
  }

  get accountingWorkbookId() {
    return this.#accountingWorkbookId;
  }
  set accountingWorkbookId(v: string) {
    this.#accountingWorkbookId = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.GS_AW_ID, v);
    }
  }

  get residentRecordsId() {
    return this.#residentRecordsId;
  }
  set residentRecordsId(v: string) {
    this.#residentRecordsId = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.GS_RR_ID, v);
    }
  }

  get sharedRecordsId() {
    return this.#sharedRecordsId;
  }
  set sharedRecordsId(v: string) {
    this.#sharedRecordsId = v;
    if (browser) {
      localStorage.setItem(LS_KEYS.GS_SR_ID, v);
    }
  }

  get isDev() {
    return dev || PUBLIC_APP_ENV === "development";
  }

  get firebaseEnabled() {
    return PUBLIC_APP_FIREBASE_ENABLED === "true";
  }

  #isSyncing = false;
  #saveTimeout: any = null;

  async syncFromServer() {
    this.#isSyncing = true;
    try {
      if (!auth.userId) {
        return;
      }
      const settings = await fetchUserSettings(true);
      const my = settings[0];
      if (my) {
        // Apply with individual safety checks
        if (my.typography) {
          this.fontFamily = my.typography as UIFont;
        }
        if (my.density) {
          this.displayDensity = my.density as DisplayDensity;
        }
        if (my.theme) {
          this.theme = my.theme;
        }
        if (my.clockFormat) {
          this.clockFormat = my.clockFormat as "12h" | "24h";
        }
        if (my.calendarView) {
          this.calendarView = my.calendarView as "month" | "week" | "day" | "history";
        }
        this.reducedMotion = !!my.isReducedMotion;
        this.#isPublicAchievementList = true;

        if (my.residentNav) {
          const nav = my.residentNav.split(",").filter(Boolean);
          if (nav.length > 0) {
            this.residentNavIds = nav;
          }
        }

        if (my.adminNav) {
          const nav = my.adminNav.split(",").filter(Boolean);
          if (nav.length > 0) {
            this.adminNavIds = nav;
          }
        }
      }
    } catch (e) {
      console.error("[Settings] Sync failed, using local/default values:", e);
    } finally {
      this.#isSyncing = false;
    }
  }

  scheduleAutoSave() {
    if (!browser || this.#isSyncing) {
      return;
    }
    if (this.#saveTimeout) {
      clearTimeout(this.#saveTimeout);
    }
    this.#saveTimeout = setTimeout(async () => {
      try {
        if (!auth.accessToken || !auth.userId) {
          return;
        }

        await this.save(auth.userId);
      } catch (e) {
        console.error("[Settings] Debounced auto-save failed:", e);
      }
    }, 600);
  }

  async save(residentId: string) {
    await updateUserSettings(residentId, {
      typography: this.fontFamily,
      density: this.displayDensity,
      theme: this.theme,
      isReducedMotion: this.reducedMotion,
      isPublic: this.isPublicAchievementList,
      residentNav: this.residentNavIds.join(","),
      adminNav: this.adminNavIds.join(","),
      clockFormat: this.clockFormat,
      calendarView: this.calendarView
    });
  }
}

export const settings = new Settings();
