import { OFFICER_COL, type OfficerRecord, OfficerStatus } from "$lib/types";
import { appendSheetRow, deleteSheetRow, fetchSheetRowsRaw, updateSheetValue } from "../common";
import type { OfficerServiceInterface } from "../interfaces/officer-service.interface";

import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";

export const sheetsOfficerService: OfficerServiceInterface = {
  async fetchOfficers(bypassCache = false): Promise<OfficerRecord[]> {
    if (auth.isResident) {
      return fetchServer("/api/resident/officers", {}, bypassCache);
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      return [];
    }
    const rows = await fetchSheetRowsRaw(settings.residentRecordsId, "directory!A:L", bypassCache);
    return rows
      .slice(1)
      .filter((row) => (row[OFFICER_COL.EMAIL] || "").trim() !== "")
      .map((row) => ({
        position: (row[OFFICER_COL.POSITION] || "").trim(),
        name: (row[OFFICER_COL.NAME] || "").trim(),
        nickname: (row[OFFICER_COL.NICKNAME] || "").trim(),
        email: (row[OFFICER_COL.EMAIL] || "").trim(),
        fbLink: (row[OFFICER_COL.FB_LINK] || "").trim(),
        term: (row[OFFICER_COL.TERM] || "").trim(),
        committee: (row[OFFICER_COL.COMMITTEE] || "").trim(),
        birthday: (row[OFFICER_COL.BIRTHDAY] || "").trim(),
        id: (row[OFFICER_COL.ID] || "").trim(),
        status: (row[OFFICER_COL.STATUS] || OfficerStatus.ACTIVE).trim(),
        photoUrl: (row[OFFICER_COL.PHOTO] || "").trim(),
        photoAutoUrl: (row[OFFICER_COL.PHOTO_AUTO] || "").trim(),
        raw: row
      }));
  },

  async addOfficer(data: Partial<OfficerRecord>): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const row = new Array(12).fill("");
    row[OFFICER_COL.POSITION] = data.position || "";
    row[OFFICER_COL.NAME] = data.name || "";
    row[OFFICER_COL.NICKNAME] = data.nickname || "";
    row[OFFICER_COL.EMAIL] = data.email || "";
    row[OFFICER_COL.FB_LINK] = data.fbLink || "";
    row[OFFICER_COL.TERM] = data.term || "";
    row[OFFICER_COL.COMMITTEE] = data.committee || "";
    row[OFFICER_COL.BIRTHDAY] = data.birthday || "";
    row[OFFICER_COL.ID] = data.id || crypto.randomUUID();
    row[OFFICER_COL.STATUS] = data.status || OfficerStatus.ACTIVE;
    row[OFFICER_COL.PHOTO] = data.photoUrl || "";
    row[OFFICER_COL.PHOTO_AUTO] = data.photoAutoUrl || "";
    await appendSheetRow(settings.residentRecordsId, "directory!A:L", [row]);
  },

  async updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(settings.residentRecordsId, "directory!A:L");
    const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Officer not found");
    }
    const actualRow = rowIndex + 1;
    const newRow = [...rows[rowIndex]];
    if (data.position !== undefined) {
      newRow[OFFICER_COL.POSITION] = data.position;
    }
    if (data.name !== undefined) {
      newRow[OFFICER_COL.NAME] = data.name;
    }
    if (data.nickname !== undefined) {
      newRow[OFFICER_COL.NICKNAME] = data.nickname;
    }
    if (data.email !== undefined) {
      newRow[OFFICER_COL.EMAIL] = data.email;
    }
    if (data.fbLink !== undefined) {
      newRow[OFFICER_COL.FB_LINK] = data.fbLink;
    }
    if (data.term !== undefined) {
      newRow[OFFICER_COL.TERM] = data.term;
    }
    if (data.committee !== undefined) {
      newRow[OFFICER_COL.COMMITTEE] = data.committee;
    }
    if (data.birthday !== undefined) {
      newRow[OFFICER_COL.BIRTHDAY] = data.birthday;
    }
    if (data.photoUrl !== undefined) {
      newRow[OFFICER_COL.PHOTO] = data.photoUrl;
    }
    if (data.photoAutoUrl !== undefined) {
      newRow[OFFICER_COL.PHOTO_AUTO] = data.photoAutoUrl;
    }
    if (data.status !== undefined) {
      newRow[OFFICER_COL.STATUS] = data.status;
    }
    await updateSheetValue(settings.residentRecordsId, `directory!A${actualRow}:L${actualRow}`, [
      newRow
    ]);
  },

  async deleteOfficer(id: string): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }
    const rows = await fetchSheetRowsRaw(settings.residentRecordsId, "directory!A:L");
    const rowIndex = rows.findIndex((r) => (r[OFFICER_COL.ID] || "").trim() === id);
    if (rowIndex === -1) {
      throw new Error("Officer not found");
    }
    await deleteSheetRow(settings.residentRecordsId, "directory", rowIndex);
  },

  async fillAutoPhoto(_email: string, _photoUrl: string): Promise<void> {
    // Sheets auto-fill is owned by the token endpoint (service account), which
    // updates the directory sheet at sign-in. Client sessions may lack sheet
    // access, so this is intentionally a no-op.
  }
};
