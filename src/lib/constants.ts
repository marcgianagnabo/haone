/**
 * Local Storage Keys
 */
export const LS_KEYS = {
  ACCESS_TOKEN: "halsk.auth.access_token",
  CREDENTIAL_JWT: "halsk.auth.credential_jwt",
  USER: "halsk.auth.user",
  REMEMBER: "halsk.auth.remember",
  STUDENT_NUMBER: "halsk.student_number",
  UI_FONT: "halsk.ui_font",
  ACC_REDUCED_MOTION: "halsk.acc.reduced_motion",
  ACC_SPACIOUS_LAYOUT: "halsk.acc.spacious_layout",
  GS_AW_ID: "halsk.gs.aw_id",
  GS_RR_ID: "halsk.gs.rr_id",
  GS_SR_ID: "halsk.gs.sr_id",
  CLEARANCE_TITLE: "halsk.clearance.signatory_title",
  CACHED_PICTURE: "halsk.auth.cached_picture",
  DISPLAY_NAME: "halsk.auth.display_name",
  AUTH_TYPE: "halsk.auth.type",
  IS_ADMIN: "halsk.auth.is_admin",
  UI_THEME: "halsk.ui.theme",
  UI_CURRENT_TERM: "halsk.ui.current_term",
  UI_SHOW_ALL_TIME_ACHIEVEMENTS: "halsk.ui.show_all_time_achievements",
  UI_CLOCK_FORMAT: "halsk.ui.clock_format",
  UI_CALENDAR_VIEW: "halsk.ui.calendar_view",
  UI_IS_PUBLIC_ACHIEVEMENTS: "halsk.ui.is_public_achievements",
  UI_NAV_RESIDENT: "halsk.ui.nav.res",
  UI_NAV_ADMIN: "halsk.ui.nav.adm",
  PWA_INSTALLED: "halsk.pwa.installed",
  PWA_BANNER_DISMISSED_AT: "halsk.pwa.banner_dismissed_at",
  SESSION_LAST_ACTIVITY: "halsk.auth.last_activity"
} as const;

export const SYSTEM_IDS = {
  FUNDS: "65eb6240-8200-48dd-a1b9-01c5994c77d7",
  IMPORTED: "45ee82f7-103f-4607-80b8-6377a76441b7",
  DUMMY: "62383fc4-ce56-407e-adb0-962f0c77a132"
} as const;
