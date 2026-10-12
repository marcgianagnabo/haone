import { fetchConstantByKey } from "$api/controllers/constants-controller";
import {
  DEFAULT_LAUNDRY_MACHINE,
  LaundryStatus,
  type LaundryMachineValue,
  type LaundryRecord
} from "$lib/types";
import { brandingState } from "$state/branding.svelte";
import { parseTimeMinutes } from "$utils/parsers";
import { getUnitForRoom } from "$utils/rooms-utils";

/**
 * Fixed laundry slot engine.
 *
 * Slots are exact 2-hour blocks separated by 30-minute turnover buffers.
 * The operating window (open/close) is per-instance configuration stored in
 * the Supabase `constants` table (`LAUNDRY_OPEN` / `LAUNDRY_CLOSE`), so each
 * hall (instance email) has its own hours. Slot length and buffer are fixed.
 *
 * No partial slots are ever emitted: if the configured window leaves a tail
 * remainder that cannot fit a full slot, the effective close is EXTENDED so
 * the final slot is a full 2 hours. The UI rules text must display the
 * effective hours (e.g. configured 5PM-10PM yields an effective later close).
 */

export const LAUNDRY_SLOT_MINUTES = 120;
export const LAUNDRY_BUFFER_MINUTES = 30;
export const LAUNDRY_OPEN_KEY = "LAUNDRY_OPEN";
export const LAUNDRY_CLOSE_KEY = "LAUNDRY_CLOSE";
export const DEFAULT_LAUNDRY_OPEN = "05:00";
export const DEFAULT_LAUNDRY_CLOSE = "22:30";
export const DEFAULT_LAUNDRY_OPEN_MINUTES = 300;
export const DEFAULT_LAUNDRY_CLOSE_MINUTES = 1350;

export interface LaundrySlot {
  /** Minutes since midnight. */
  start: number;
  /** Minutes since midnight (always start + LAUNDRY_SLOT_MINUTES). */
  end: number;
}

export interface LaundryGrid {
  slots: LaundrySlot[];
  /** Configured open (minutes). */
  open: number;
  /** Configured close (minutes). */
  close: number;
  /** Close actually rendered/enforced (== close, or later when extended). */
  effectiveClose: number;
  /** True when the tail was extended to avoid a partial slot. */
  extended: boolean;
}

export function minutesToHHMM(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function formatSlotMinutes(min: number, clockFormat: "12h" | "24h" = "12h"): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  const mStr = m.toString().padStart(2, "0");
  if (clockFormat === "24h") {
    return `${h24.toString().padStart(2, "0")}:${mStr}`;
  }
  const h12 = h24 % 12 || 12;
  const ampm = h24 >= 12 ? "PM" : "AM";
  return `${h12}:${mStr} ${ampm}`;
}

/**
 * Build the fixed slot grid for a window. Only full 2-hour slots are
 * emitted; a leftover tail extends the effective close so the last slot
 * stays whole instead of becoming a partial slot.
 */
export function buildLaundrySlots(
  openMin: number,
  closeMin: number,
  slotMinutes: number = LAUNDRY_SLOT_MINUTES,
  bufferMinutes: number = LAUNDRY_BUFFER_MINUTES
): LaundryGrid {
  const open = Math.floor(openMin);
  const close = Math.floor(closeMin);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open >= close) {
    return { slots: [], open, close, effectiveClose: close, extended: false };
  }
  const slots: LaundrySlot[] = [];
  let cursor = open;
  while (cursor + slotMinutes <= close) {
    slots.push({ start: cursor, end: cursor + slotMinutes });
    cursor += slotMinutes + bufferMinutes;
  }
  let effectiveClose = close;
  let extended = false;
  if (cursor < close) {
    // Tail remainder: extend so the final slot is full instead of partial.
    slots.push({ start: cursor, end: cursor + slotMinutes });
    effectiveClose = cursor + slotMinutes;
    extended = true;
  }
  return { slots, open, close, effectiveClose, extended };
}

export function isFixedLaundrySlot(
  startMin: number,
  endMin: number,
  grid: LaundryGrid,
  slotMinutes: number = LAUNDRY_SLOT_MINUTES
): boolean {
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    return false;
  }
  if (endMin - startMin !== slotMinutes) {
    return false;
  }
  return grid.slots.some((s) => s.start === startMin && s.end === endMin);
}

/** True when a minute falls inside a 30-min turnover buffer (or extended tail gap). */
export function isInLaundryBuffer(
  min: number,
  grid: LaundryGrid,
  bufferMinutes: number = LAUNDRY_BUFFER_MINUTES
): boolean {
  if (grid.slots.length === 0) {
    return false;
  }
  if (min < grid.open || min >= grid.effectiveClose) {
    return false;
  }
  for (const s of grid.slots) {
    if (min >= s.start && min < s.end) {
      return false;
    }
  }
  // Inside the window but not inside a slot => buffer/turnover time.
  void bufferMinutes;
  return true;
}

function sanitizeMinutes(raw: string | null, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = parseTimeMinutes(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1440) {
    return fallback;
  }
  return parsed;
}

let cachedConfig: { open: number; close: number } | null = null;
let inflight: Promise<{ open: number; close: number }> | null = null;

export function clearLaundryHoursCache(): void {
  cachedConfig = null;
  inflight = null;
}

/**
 * Per-instance laundry hours from the Supabase `constants` table.
 * Each instance (hall) has its own constants rows, so hours never leak
 * across instances. Falls back to 05:00-22:00 when keys are absent/invalid.
 */
export async function getLaundryHoursConfig(
  bypassCache = false
): Promise<{ open: number; close: number }> {
  if (!bypassCache && cachedConfig) {
    return cachedConfig;
  }
  if (!bypassCache && inflight) {
    return inflight;
  }
  const job = (async () => {
    try {
      const [openRaw, closeRaw] = await Promise.all([
        fetchConstantByKey(LAUNDRY_OPEN_KEY),
        fetchConstantByKey(LAUNDRY_CLOSE_KEY)
      ]);
      let open = sanitizeMinutes(openRaw, DEFAULT_LAUNDRY_OPEN_MINUTES);
      let close = sanitizeMinutes(closeRaw, DEFAULT_LAUNDRY_CLOSE_MINUTES);
      if (!(open < close)) {
        open = DEFAULT_LAUNDRY_OPEN_MINUTES;
        close = DEFAULT_LAUNDRY_CLOSE_MINUTES;
      }
      cachedConfig = { open, close };
      return cachedConfig;
    } catch {
      cachedConfig = {
        open: DEFAULT_LAUNDRY_OPEN_MINUTES,
        close: DEFAULT_LAUNDRY_CLOSE_MINUTES
      };
      return cachedConfig;
    } finally {
      inflight = null;
    }
  })();
  inflight = job;
  return job;
}

export async function getLaundryGrid(bypassCache = false): Promise<LaundryGrid> {
  const { open, close } = await getLaundryHoursConfig(bypassCache);
  return buildLaundrySlots(open, close);
}

/**
 * Admin 24-hour grid (00:00-24:00) with the same 2h slot + 30m turnover
 * buffers. No outside-hours concept; buffer gaps stay blocked.
 */
export function getAdminLaundryGrid(): LaundryGrid {
  return buildLaundrySlots(0, 1440);
}

// PROMO-REMOVE-AFTER-2026-10-25: two-week advance booking window
// (Oct 12-25, 2026). To retire: delete the promo constants and the four
// helpers below, then restore `isDateInCurrentWeek` + the hardcoded
// current-week message at the two controller call sites and the `weekEndStr`
// derivation in LaundryCalendar. `grep PROMO-REMOVE-AFTER-2026-10-25`
// lists every line. Behavior reverts to current-week-only automatically.
export const BOOKING_PROMO_START = "2026-10-12";
export const BOOKING_HARD_CAP = "2026-10-25";

// PROMO-REMOVE-AFTER-2026-10-25: Oct 12-18, 2026 is closed for booking.
// Only Oct 19-25 stays open, then the normal current-week window takes over
// on Oct 19 on its own (the lower bound derives from `startOfMonday(now)`), so
// this constant goes inert by itself and needs no expiry check.
export const BOOKING_FLOOR = "2026-10-19";

/** True while today falls inside the one-time Oct 12-25, 2026 promo. */
export function isTwoWeekWindow(now = new Date()): boolean {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
  return today >= BOOKING_PROMO_START && today <= BOOKING_HARD_CAP;
}

function startOfMonday(now: Date): Date {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function endOfWeekSunday(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Latest bookable instant: end of next week during the promo (hard-capped
 * at Oct 25, 2026), otherwise end of the current week.
 */
export function getBookingWindowEnd(now = new Date()): Date {
  const thisSunday = endOfWeekSunday(startOfMonday(now));
  if (!isTwoWeekWindow(now)) {
    return thisSunday;
  }
  const nextSunday = new Date(thisSunday);
  nextSunday.setDate(nextSunday.getDate() + 7);
  const [cy, cm, cd] = BOOKING_HARD_CAP.split("-").map(Number);
  const cap = new Date(cy, cm - 1, cd, 23, 59, 59, 999);
  return nextSunday < cap ? nextSunday : cap;
}

/**
 * Earliest bookable instant: Monday of the current week, raised to the promo
 * floor while the floor is still in the future. Once the clock passes the
 * floor this collapses back to `startOfMonday(now)` automatically.
 */
export function getBookingWindowStart(now = new Date()): Date {
  const monday = startOfMonday(now);
  const [fy, fm, fd] = BOOKING_FLOOR.split("-").map(Number);
  const floor = new Date(fy, fm - 1, fd);
  return floor > monday ? floor : monday;
}

/** Monday of the current week through the booking window end. */
export function isBookingDateAllowed(dateStr: string, now = new Date()): boolean {
  const parts = (dateStr || "").split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) {
    return false;
  }
  const selDay = new Date(parts[0], parts[1] - 1, parts[2]);
  return selDay >= getBookingWindowStart(now) && selDay <= getBookingWindowEnd(now);
}

export function bookingWindowMessage(now = new Date()): string {
  const floor = getBookingWindowStart(now);
  const [fy, fm, fd] = BOOKING_FLOOR.split("-").map(Number);
  if (floor.getFullYear() === fy && floor.getMonth() === fm - 1 && floor.getDate() === fd) {
    return "Bookings for October 12-18 are closed. Bookings reopen on October 19";
  }
  if (isTwoWeekWindow(now)) {
    return "Bookings are open until Oct 25";
  }
  return "Bookings are only open for the current week (Monday to Sunday)";
}

/**
 * End datetime of a booking, or null when the date/time cannot be parsed.
 * Mirrors the effective-COMPLETED derivation in LaundryReservationHistory
 * (minute precision instead of hour precision).
 */
export function getBookingEndDate(record: Pick<LaundryRecord, "date" | "timeEnd">): Date | null {
  const parts = (record.date || "").split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) {
    return null;
  }
  const endMin = parseTimeMinutes(record.timeEnd || "");
  if (!Number.isFinite(endMin) || endMin < 0) {
    return null;
  }
  return new Date(parts[0], parts[1] - 1, parts[2], Math.floor(endMin / 60), endMin % 60);
}

/**
 * A booking is finished once its end datetime has passed. Cancelled and
 * stored-completed bookings never block. Unparseable rows stay blocking
 * (fail closed), matching the history display semantics.
 */
export function isBookingUnfinished(
  record: Pick<LaundryRecord, "date" | "timeEnd" | "status">,
  now = new Date()
): boolean {
  if (record.status !== LaundryStatus.ACTIVE) {
    return false;
  }
  const end = getBookingEndDate(record);
  if (!end) {
    return true;
  }
  return end.getTime() >= now.getTime();
}

/**
 * The resident's unfinished booking (if any): their single ACTIVE booking
 * whose end datetime has not passed yet. Earliest-ending first.
 */
export function getUnfinishedBooking(
  reservations: Pick<LaundryRecord, "date" | "timeEnd" | "status" | "residentId">[],
  residentId: string,
  now = new Date()
): LaundryRecord | null {
  if (!residentId) {
    return null;
  }
  const mine = (reservations || []).filter(
    (r) => r.residentId === residentId && isBookingUnfinished(r, now)
  );
  mine.sort((a, b) => {
    const ea = getBookingEndDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const eb = getBookingEndDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ea - eb;
  });
  return (mine[0] as LaundryRecord) ?? null;
}

/**
 * Wing machine for a room number: L* rooms focus Left Wing, R* rooms focus
 * Right Wing, anything else (U / upper floors / unknown) sees all machines.
 */
export function wingMachineForRoom(room: string, profile?: string): LaundryMachineValue | "ALL" {
  const key = profile || brandingState.selectedKey;
  const unit = getUnitForRoom((room || "").trim(), key);
  const id = (unit?.id || "").toUpperCase();
  if (id === "L") {
    return "LEFT_WING";
  }
  if (id === "R") {
    return "RIGHT_WING";
  }
  return "ALL";
}

export function defaultMachineForRoom(room: string): LaundryMachineValue {
  const wing = wingMachineForRoom(room);
  return wing === "ALL" ? DEFAULT_LAUNDRY_MACHINE : wing;
}
