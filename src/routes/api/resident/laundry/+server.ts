import { canAccessLaundry, canSeeLaundryNames } from "$api/controllers/resident-controller";
import {
  authenticateResident,
  getSheetsClient,
  resolveResidentAccountType
} from "$api/services/auth-service";
import {
  appendSheetValue,
  fetchSheetsData,
  serverError
} from "$api/services/server-sheets-service";
import { getFeatureFlagValue } from "$api/utils/feature-flags";
import { PUBLIC_GS_SR_ID } from "$env/static/public";
import { ACCOUNT_COL, DEFAULT_LAUNDRY_MACHINE, FeatureFlagKey, LAUNDRY_COL, LaundryStatus, USER_COL } from "$lib/types";
import { formatTime } from "$utils/formatters";
import { parseTimeMinutes } from "$utils/parsers";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET: Fetch all reservations + user room mapping
 */
export const GET: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();

    const [resRows, accRows, userRows, activeTerm] = await fetchSheetsData(client, [
      "laundry!A:J",
      "accounts!A:L",
      "users!A:P",
      "TERM_CURR"
    ]);

    const isLaundryEnabled = getFeatureFlagValue(FeatureFlagKey.LAUNDRY_SERVICE, true);

    if (!isLaundryEnabled) {
      return json({ error: "Access Denied: Laundry service is disabled" }, { status: 403 });
    }

    const accountType = resolveResidentAccountType(accRows, activeTerm, residentId);

    if (!canAccessLaundry(accountType || "")) {
      return json({ error: "Access Denied: Account type cannot access laundry" }, { status: 403 });
    }

    const maskNames = !canSeeLaundryNames(accountType || "");

    const currentResidentId = residentId;

    // Build user map
    const userMap = new Map();
    userRows.slice(1).forEach((r: any) => {
      userMap.set((r[USER_COL.ID] || "").trim(), r);
    });

    // Build room map
    const resIdToRoomMap = new Map();
    accRows.slice(1).forEach((r: any) => {
      const resId = (r[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (resId && (term === activeTerm || !term)) {
        const room = (r[ACCOUNT_COL.ROOM] || "").trim();
        if (room) {
          resIdToRoomMap.set(resId, room);
        }
      }
    });

    const reservations = resRows.slice(1).map((row: any) => {
      const resId = (row[LAUNDRY_COL.RESIDENT_ID] || "").trim();
      const user = userMap.get(resId);
      let name = "Resident";
      if (user) {
        name =
          (user[USER_COL.DISPLAY_NAME] || "").trim() ||
          `${user[USER_COL.FIRST_NAME] || ""} ${user[USER_COL.LAST_NAME] || ""}`.trim();
      }

      const isSelf = resId === currentResidentId;
      const displayName = isSelf ? name : maskNames ? "Resident" : name;

      return {
        id: (row[LAUNDRY_COL.ID] || "").trim(),
        residentId: resId,
        date: (row[LAUNDRY_COL.DATE] || "").trim(),
        timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
        timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
        status: (row[LAUNDRY_COL.STATUS] || "ACTIVE").trim(),
        cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
        machine: (row[LAUNDRY_COL.MACHINE] || DEFAULT_LAUNDRY_MACHINE).trim(),
        creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
        cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim(),
        displayName,
        room: resIdToRoomMap.get(resId) || ""
      };
    });

    return json({ reservations, currentResidentId });
  } catch (e: any) {
    return serverError(e, "Laundry GET");
  }
};

/**
 * POST: Create a new reservation
 */
export const POST: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();
    const [accRows, activeTerm] = await fetchSheetsData(client, ["accounts!A:L", "TERM_CURR"]);

    const isLaundryEnabled = getFeatureFlagValue(FeatureFlagKey.LAUNDRY_SERVICE, true);

    if (!isLaundryEnabled) {
      return json({ error: "Access Denied: Laundry service is disabled" }, { status: 403 });
    }

    const accountType = resolveResidentAccountType(accRows, activeTerm, residentId);

    if (!canAccessLaundry(accountType || "")) {
      return json({ error: "Access Denied: Account type cannot book laundry" }, { status: 403 });
    }

    const data = await request.json();
    const { date, timeStart, timeEnd, machine } = data;
    const bookedMachine = machine || DEFAULT_LAUNDRY_MACHINE;

    if (!date || !timeStart || !timeEnd) {
      return json({ error: "Date, Start Time, and End Time are required" }, { status: 400 });
    }

    const startMinutes = parseTimeMinutes(timeStart);
    const endMinutes = parseTimeMinutes(timeEnd);

    if (isNaN(startMinutes) || isNaN(endMinutes)) {
      return json({ error: "Invalid time format" }, { status: 400 });
    }

    if (endMinutes <= startMinutes) {
      return json({ error: "End time must be after start time" }, { status: 400 });
    }

    const duration = endMinutes - startMinutes;
    if (duration > 180) {
      return json({ error: "Reservations cannot exceed 3 hours" }, { status: 400 });
    }

    const [resRows] = await fetchSheetsData(client, ["laundry!A:J"]);
    const existing = resRows.slice(1).map((r: any) => ({
      id: r[LAUNDRY_COL.ID],
      residentId: r[LAUNDRY_COL.RESIDENT_ID],
      date: r[LAUNDRY_COL.DATE],
      timeStart: r[LAUNDRY_COL.TIME_START],
      timeEnd: r[LAUNDRY_COL.TIME_END],
      status: r[LAUNDRY_COL.STATUS] || "ACTIVE",
      machine: (r[LAUNDRY_COL.MACHINE] || DEFAULT_LAUNDRY_MACHINE).trim()
    }));

    const activeReservations = existing.filter(
      (r: any) => r.status !== "CANCELLED_BY_ADMIN" && r.status !== "CANCELLED_BY_USER"
    );

    const dateClashes = activeReservations.filter(
      (r: any) => r.date === date && r.machine === bookedMachine
    );
    for (const res of dateClashes) {
      const exStart = parseTimeMinutes(res.timeStart);
      const exEnd = parseTimeMinutes(res.timeEnd);
      if (!isNaN(exStart) && !isNaN(exEnd)) {
        if (startMinutes < exEnd && endMinutes > exStart) {
          return json(
            {
              error: `Slot Unavailable: Clashes with reservation from ${formatTime(res.timeStart)} to ${formatTime(res.timeEnd)}`
            },
            { status: 409 }
          );
        }
      }
    }

    const id = crypto.randomUUID();
    const nowStr = new Date().toISOString();

    const row = [id, residentId, date, timeStart, timeEnd, "ACTIVE", "", nowStr, "", bookedMachine];

    await appendSheetValue(client, PUBLIC_GS_SR_ID, "laundry!A:J", [row]);

    return json({ success: true, id });
  } catch (e: any) {
    return serverError(e, "Laundry POST");
  }
};

/**
 * DELETE: Cancel a reservation
 */
export const DELETE: RequestHandler = async ({ request }) => {
  const { residentId, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  const { id, reason } = await request.json();

  if (!id) {
    return json({ error: "Reservation ID is required" }, { status: 400 });
  }

  if (!reason || reason.trim() === "") {
    return json({ error: "Cancellation reason is required" }, { status: 400 });
  }

  try {
    const client = await getSheetsClient();
    const [resRows] = await fetchSheetsData(client, ["laundry!A:J"]);

    const isLaundryEnabled = getFeatureFlagValue(FeatureFlagKey.LAUNDRY_SERVICE, true);

    if (!isLaundryEnabled) {
      return json({ error: "Access Denied: Laundry service is disabled" }, { status: 403 });
    }

    const rowIndex = resRows
      .slice(1)
      .findIndex(
        (r: any) =>
          (r[LAUNDRY_COL.ID] || "").trim() === id &&
          (r[LAUNDRY_COL.RESIDENT_ID] || "").trim() === residentId
      );

    if (rowIndex === -1) {
      return json({ error: "Reservation not found or unauthorized" }, { status: 404 });
    }

    const actualRow = rowIndex + 2;
    const nowStr = new Date().toISOString();

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${PUBLIC_GS_SR_ID}/values/laundry!F${actualRow}:I${actualRow}?valueInputOption=USER_ENTERED`;

    await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${client}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [[LaundryStatus.CANCELLED_BY_USER, reason, resRows[rowIndex + 1][7] || "", nowStr]]
      })
    });

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Laundry DELETE");
  }
};
