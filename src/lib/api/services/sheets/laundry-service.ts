import {
  DEFAULT_LAUNDRY_MACHINE,
  LAUNDRY_COL,
  type LaundryRecord,
  LaundryStatus,
  type PaginatedResponse,
  type PaginationOptions
} from "$lib/types";
import { appendSheetRow, fetchSheetRowsRaw, updateSheetValue } from "../common";
import type { LaundryServiceInterface } from "../interfaces/laundry-service.interface";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsLaundryService: LaundryServiceInterface = {
  async fetchReservations(
    residentId?: string,
    options?: PaginationOptions,
    bypassCache = false
  ): Promise<LaundryRecord[] | PaginatedResponse<LaundryRecord>> {
    const shouldRefresh = bypassCache || options?.bypassCache || false;
    if (auth.isResident) {
      const data = await fetchServer("/api/resident/laundry", {}, shouldRefresh);
      return Array.isArray(data) ? data : data.reservations || [];
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.sharedRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(settings.sharedRecordsId, "laundry!A:J", shouldRefresh);
    let items = rows.slice(1).map((row) => ({
      id: (row[LAUNDRY_COL.ID] || "").trim(),
      residentId: (row[LAUNDRY_COL.RESIDENT_ID] || "").trim(),
      date: (row[LAUNDRY_COL.DATE] || "").trim(),
      timeStart: (row[LAUNDRY_COL.TIME_START] || "").trim(),
      timeEnd: (row[LAUNDRY_COL.TIME_END] || "").trim(),
      status: (row[LAUNDRY_COL.STATUS] || LaundryStatus.ACTIVE).trim(),
      cancelReason: (row[LAUNDRY_COL.CANCEL_REASON] || "").trim(),
      machine: (row[LAUNDRY_COL.MACHINE] || DEFAULT_LAUNDRY_MACHINE).trim(),
      creationTimestamp: (row[LAUNDRY_COL.CREATION_TIMESTAMP] || "").trim(),
      cancelTimestamp: (row[LAUNDRY_COL.CANCEL_TIMESTAMP] || "").trim(),
      raw: row
    }));
    if (residentId) {
      items = items.filter((r) => r.residentId === residentId);
    }
    return items;
  },

  async addReservation(data: Partial<LaundryRecord>): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/laundry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      return;
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const row = new Array(10).fill("");
    row[LAUNDRY_COL.ID] = data.id || crypto.randomUUID();
    row[LAUNDRY_COL.RESIDENT_ID] = data.residentId || "";
    row[LAUNDRY_COL.DATE] = data.date || "";
    row[LAUNDRY_COL.TIME_START] = data.timeStart || "";
    row[LAUNDRY_COL.TIME_END] = data.timeEnd || "";
    row[LAUNDRY_COL.STATUS] = data.status || LaundryStatus.ACTIVE;
    row[LAUNDRY_COL.CANCEL_REASON] = data.cancelReason || "";
    row[LAUNDRY_COL.MACHINE] = data.machine || DEFAULT_LAUNDRY_MACHINE;
    row[LAUNDRY_COL.CREATION_TIMESTAMP] = data.creationTimestamp || new Date().toISOString();
    row[LAUNDRY_COL.CANCEL_TIMESTAMP] = data.cancelTimestamp || "";
    await appendSheetRow(settings.sharedRecordsId, "laundry!A:J", [row]);
  },

  async addReservationsBatch(entries: Partial<LaundryRecord>[]): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = entries.map((data) => {
      const row = new Array(10).fill("");
      row[LAUNDRY_COL.ID] = data.id || crypto.randomUUID();
      row[LAUNDRY_COL.RESIDENT_ID] = data.residentId || "";
      row[LAUNDRY_COL.DATE] = data.date || "";
      row[LAUNDRY_COL.TIME_START] = data.timeStart || "";
      row[LAUNDRY_COL.TIME_END] = data.timeEnd || "";
      row[LAUNDRY_COL.STATUS] = data.status || LaundryStatus.ACTIVE;
      row[LAUNDRY_COL.CANCEL_REASON] = data.cancelReason || "";
      row[LAUNDRY_COL.MACHINE] = data.machine || DEFAULT_LAUNDRY_MACHINE;
      row[LAUNDRY_COL.CREATION_TIMESTAMP] = data.creationTimestamp || new Date().toISOString();
      row[LAUNDRY_COL.CANCEL_TIMESTAMP] = data.cancelTimestamp || "";
      return row;
    });
    await appendSheetRow(settings.sharedRecordsId, "laundry!A:J", rows);
  },

  async cancelReservation(id: string, reason: string): Promise<void> {
    if (auth.isResident) {
      await fetchServer("/api/resident/laundry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, reason })
      });
      return;
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.sharedRecordsId) {
      throw new Error("Shared Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(settings.sharedRecordsId, "laundry!A:J");
    const rowIndex = rows.findIndex((r) => (r[LAUNDRY_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Reservation not found");
    }
    const actualRow = rowIndex + 1;
    const nowStr = new Date().toISOString();
    await Promise.all([
      updateSheetValue(settings.sharedRecordsId, `laundry!F${actualRow}`, [
        [LaundryStatus.CANCELLED_BY_ADMIN]
      ]),
      updateSheetValue(settings.sharedRecordsId, `laundry!G${actualRow}`, [[reason]]),
      updateSheetValue(settings.sharedRecordsId, `laundry!I${actualRow}`, [[nowStr]])
    ]);
  }
};
