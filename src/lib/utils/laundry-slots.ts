import { fetchConstantByKey } from "$api/controllers/constants-controller";
import { parseTimeMinutes } from "$utils/parsers";

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
