import { laundryService } from "$api/services/laundry-service";
import { fetchFeatureFlagMulti } from "$api/utils/feature-flags";
import {
  type LaundryRecord,
  type PaginatedResponse,
  type PaginationOptions,
  DEFAULT_LAUNDRY_MACHINE,
  FeatureFlagKey,
  LaundryStatus
} from "$lib/types";
import { residentState } from "$state/resident-state.svelte";
import { parseTimeMinutes } from "$utils/parsers";
import { canAccessLaundry, getSignedInUserId } from "./resident-controller";

export interface ValidateLaundryOptions {
  date: string;
  timeStart: string;
  timeEnd: string;
  residentId?: string;
  isAdmin?: boolean;
  machine?: string;
  existingReservations?: LaundryRecord[];
}

export function validateLaundryReservation(options: ValidateLaundryOptions): string | null {
  try {
    const {
      date,
      timeStart,
      timeEnd,
      residentId,
      isAdmin = false,
      machine,
      existingReservations = []
    } = options;

    const targetMachine = machine || DEFAULT_LAUNDRY_MACHINE;

    if (!date) {
      return "Please select a date";
    }
    if (!timeStart || !timeEnd) {
      return "Please provide times";
    }
    if (isAdmin && !residentId) {
      return "Please select a resident";
    }

    const startMinutes = parseTimeMinutes(timeStart);
    const endMinutes = parseTimeMinutes(timeEnd);
    if (isNaN(startMinutes) || isNaN(endMinutes)) {
      return "Invalid time format";
    }

    if (startMinutes >= endMinutes) {
      return "Start must be before end";
    }

    const durationMinutes = endMinutes - startMinutes;
    if (!isAdmin && durationMinutes > 120) {
      return "Max 2 hours per day allowed";
    }

    if (!isAdmin) {
      const targetResidentId = residentId;
      if (targetResidentId) {
        const residentDayMinutes = existingReservations
          .filter((r) => {
            if (
              r.status !== LaundryStatus.ACTIVE ||
              r.date !== date ||
              r.residentId !== targetResidentId
            ) {
              return false;
            }
            return true;
          })
          .reduce((total, r) => {
            const s = parseTimeMinutes(r.timeStart);
            const e = parseTimeMinutes(r.timeEnd);
            if (!isNaN(s) && !isNaN(e) && e > s) {
              return total + (e - s);
            }
            return total;
          }, 0);

        if (residentDayMinutes + durationMinutes > 120) {
          return "Max 2 hours per day allowed";
        }
      }

      const [y, m, d] = date.split("-").map(Number);
      const startH = Math.floor(startMinutes / 60);
      const startM = startMinutes % 60;
      const selectedDateTime = new Date(y, m - 1, d, startH, startM);
      const now = new Date();
      const isToday = y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();

      if (isToday) {
        if (selectedDateTime.getTime() < now.getTime()) {
          return "Cannot reserve for a past time";
        }
      } else if (selectedDateTime < now) {
        return "Cannot reserve for a past time";
      }

      const maxAdvance = new Date();
      maxAdvance.setDate(now.getDate() + 14);
      if (selectedDateTime > maxAdvance) {
        return "Max 2 weeks in advance";
      }
      if (startMinutes < 300 || endMinutes > 1320) {
        return "Open 5 AM - 10 PM only";
      }
    }

    const isOverlapping = existingReservations.some((r) => {
      if (r.status !== LaundryStatus.ACTIVE || r.date !== date) {
        return false;
      }
      const rMachine = r.machine || DEFAULT_LAUNDRY_MACHINE;
      if (rMachine !== targetMachine) {
        return false;
      }
      const rStart = parseTimeMinutes(r.timeStart);
      const rEnd = parseTimeMinutes(r.timeEnd);
      return startMinutes < rEnd && endMinutes > rStart;
    });
    if (isOverlapping) {
      return "Overlaps with existing booking";
    }

    return null;
  } catch {
    return "Invalid reservation details";
  }
}

export async function checkFeatureEnabled() {
  const [laundryEnabled] = await fetchFeatureFlagMulti([FeatureFlagKey.LAUNDRY_SERVICE], true);
  if (!laundryEnabled) {
    throw new Error("Access Denied: Laundry service not enabled. Check back later!");
  }
}

export async function fetchLaundryReservations(
  bypassCache = false
): Promise<{ reservations: LaundryRecord[]; currentResidentId: string }> {
  await checkFeatureEnabled();
  const currentResidentId = await getSignedInUserId();
  // Fetch every booking so residents can see occupied slots and the overlap
  // guard covers other residents' bookings. Which rows the resident can read
  // is governed by the laundry_select RLS policy.
  const res = await laundryService.fetchReservations(undefined, undefined, bypassCache);
  const list = Array.isArray(res) ? res : res.items;
  return {
    reservations: list,
    currentResidentId
  };
}

export async function addLaundryReservation(
  data: Partial<LaundryRecord>,
  isAdmin = false
): Promise<void> {
  await checkFeatureEnabled();
  if (!isAdmin) {
    const accountType =
      residentState.status?.account?.type || residentState.status?.currEntry?.accountType || "";
    if (!canAccessLaundry(accountType)) {
      throw new Error("Access Denied: Account type cannot book laundry");
    }
  }

  const { date, timeStart, timeEnd } = data;
  if (!date || !timeStart || !timeEnd) {
    throw new Error("Date, Start Time, and End Time are required");
  }

  const startMinutes = parseTimeMinutes(timeStart);
  const endMinutes = parseTimeMinutes(timeEnd);
  if (isNaN(startMinutes) || isNaN(endMinutes) || endMinutes <= startMinutes) {
    throw new Error("Invalid time window specified");
  }

  if (!isAdmin && endMinutes - startMinutes > 120) {
    throw new Error("Reservations cannot exceed 2 hours");
  }

  const currentResidentId = data.residentId || (await getSignedInUserId());
  const machine = data.machine || DEFAULT_LAUNDRY_MACHINE;
  const res = await laundryService.fetchReservations();
  const list = Array.isArray(res) ? res : res.items;
  const active = list.filter(
    (r) =>
      r.status !== LaundryStatus.CANCELLED_BY_ADMIN && r.status !== LaundryStatus.CANCELLED_BY_USER
  );

  if (!isAdmin && currentResidentId) {
    const durationMinutes = endMinutes - startMinutes;
    const existingResidentDayMinutes = active
      .filter((r) => r.date === date && r.residentId === currentResidentId)
      .reduce((total, r) => {
        const s = parseTimeMinutes(r.timeStart);
        const e = parseTimeMinutes(r.timeEnd);
        if (!isNaN(s) && !isNaN(e) && e > s) {
          return total + (e - s);
        }
        return total;
      }, 0);

    if (existingResidentDayMinutes + durationMinutes > 120) {
      throw new Error("Maximum of two (2) hours per day allowed");
    }
  }

  const sameSlotUser = active.find(
    (r) =>
      r.date === date &&
      r.timeStart === timeStart &&
      r.timeEnd === timeEnd &&
      (r.machine || DEFAULT_LAUNDRY_MACHINE) === machine &&
      r.residentId === currentResidentId
  );
  if (sameSlotUser) {
    throw new Error("You have already booked this exact slot");
  }

  return laundryService.addReservation({
    ...data,
    residentId: currentResidentId,
    machine,
    status: LaundryStatus.ACTIVE
  });
}

export async function cancelLaundryReservation(
  reservationId: string,
  reason: string,
  _status: any = null
) {
  await checkFeatureEnabled();
  return await laundryService.cancelReservation(reservationId, reason || "Cancelled by resident");
}

export async function fetchAdminLaundryReservations(
  bypassCache = false,
  options?: PaginationOptions
): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
  await checkFeatureEnabled();
  return laundryService.fetchReservations(undefined, options, bypassCache);
}

export async function cancelAdminLaundryReservation(
  reservationId: string,
  reason: string,
  _status: any = null
) {
  await checkFeatureEnabled();
  await laundryService.cancelReservation(reservationId, reason || "Cancelled by admin");
}

export async function addLaundryReservationsBatch(entries: Partial<LaundryRecord>[]) {
  await checkFeatureEnabled();
  await laundryService.addReservationsBatch(entries);
}
