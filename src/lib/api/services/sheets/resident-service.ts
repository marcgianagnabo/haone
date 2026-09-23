import type { ResidentRecord, UserRecord } from "$lib/types";
import { ACCOUNT_COL, TRANSACTION_TYPE_CONFIG, TransactionType, USER_COL } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { fetchServer } from "$utils/api-client";
import { parseCSVAmount } from "$utils/math";
import { computeDisplayNames, mapRowToJournal, mapRowToResident } from "../../utils/row-mappers";
import {
  appendSheetRow,
  batchUpdateValues,
  deleteSheetRow,
  fetchSheetRowsRaw,
  updateSheetValue
} from "../common";
import type { ResidentServiceInterface } from "../interfaces/resident-service.interface";

export const sheetsResidentService: ResidentServiceInterface = {
  async fetchResidents(bypassCache = false, term?: string): Promise<ResidentRecord[]> {
    if (auth.isResident) {
      const data = await fetchServer("/api/resident/occupancy", {}, bypassCache);
      return data.accounts;
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.accountingWorkbookId || !settings.residentRecordsId) {
      return [];
    }

    const [accRows, userRows, journalRows, constRows] = await Promise.all([
      fetchSheetRowsRaw(settings.accountingWorkbookId, "accounts!A:L", bypassCache),
      fetchSheetRowsRaw(settings.residentRecordsId, "users!A:P", bypassCache),
      fetchSheetRowsRaw(settings.accountingWorkbookId, "journal_general!A:V", bypassCache),
      fetchSheetRowsRaw(settings.accountingWorkbookId, "constants!A:C", bypassCache)
    ]);

    const userMap = new Map<string, string[]>();
    userRows.slice(1).forEach((row) => {
      const id = (row[USER_COL.ID] || "").trim();
      if (id) {
        userMap.set(id, row);
      }
    });

    const journal = journalRows.slice(1).map((r, idx) => mapRowToJournal(r, idx + 2));

    const getConst = (key: string) => constRows.find((r) => r[0] === key)?.[1] || "0";
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;

    const allResidents = accRows
      .slice(1)
      .map((row) => {
        const resId = (row[ACCOUNT_COL.RESIDENT_ID] || "").trim();
        const userRow = resId ? userMap.get(resId) : undefined;
        const period = (row[ACCOUNT_COL.PERIOD] || "").trim();
        const email = userRow ? (userRow[USER_COL.EMAIL] || "").trim().toLowerCase() : "";
        const stno = userRow ? (userRow[USER_COL.STUDENT_NO] || "").trim().toLowerCase() : "";

        const filtered = journal.filter((j) => {
          if (j.period !== period) {
            return false;
          }
          const acc = (j.account || "").trim().toLowerCase();
          const jAccId = (j.accountId || "").trim().toLowerCase();
          const jStNo = (j.stno || "").trim().toLowerCase();
          return (
            (resId && jAccId === resId.toLowerCase()) ||
            (resId && acc === resId.toLowerCase()) ||
            (email && acc === email) ||
            (stno && acc === stno) ||
            (stno && jStNo === stno)
          );
        });

        const isWaivedEntry = (type: string) =>
          type === pmtWaived || type.toUpperCase().includes("WAIVED");

        const waterPaid = filtered
          .filter((j) => !isWaivedEntry(j.type))
          .reduce((sum, j) => sum + j.water, 0);
        const waterWaived = filtered
          .filter((j) => isWaivedEntry(j.type))
          .reduce((sum, j) => sum + j.water, 0);

        const assocPaid = filtered
          .filter((j) => !isWaivedEntry(j.type))
          .reduce((sum, j) => sum + j.assoc, 0);
        const assocWaived = filtered
          .filter((j) => isWaivedEntry(j.type))
          .reduce((sum, j) => sum + j.assoc, 0);

        const miscPaid = filtered.reduce((sum, j) => sum + j.misc, 0);

        const waterBase = parseCSVAmount(getConst(`FEES_${period}_WATER`));
        const assocBase = parseCSVAmount(getConst(`FEES_${period}_ASSOC`));

        const financials = {
          waterBase,
          waterPaid,
          waterWaived,
          assocBase,
          assocPaid,
          assocWaived,
          miscPaid
        };

        return mapRowToResident(row, userRow, financials);
      })
      .filter((r) => r.residentId && r.residentId !== "");

    if (term) {
      return allResidents.filter((r) => r.period === term);
    }
    return allResidents;
  },

  async fetchResidentStatus(term?: string, bypassCache = false): Promise<any> {
    const query = term ? `?term=${encodeURIComponent(term)}` : "";
    return fetchServer(`/api/resident/check-status${query}`, {}, bypassCache);
  },

  async changeAccountType(residentId: string, period: string, newType: string): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const accRows = await fetchSheetRowsRaw(settings.accountingWorkbookId, "accounts!A:L");
    const rowIndex = accRows.findIndex(
      (r) =>
        (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId &&
        (r[ACCOUNT_COL.PERIOD] || "").trim() === period
    );
    if (rowIndex === -1) {
      throw new Error("Account row not found in spreadsheet.");
    }
    const actualRow = rowIndex + 1;
    await updateSheetValue(settings.accountingWorkbookId, `accounts!L${actualRow}`, [[newType]]);
  },

  async fetchUsers(bypassCache = false): Promise<UserRecord[]> {
    if (auth.isResident) {
      return [];
    }

    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      return [];
    }

    const userRows = await fetchSheetRowsRaw(settings.residentRecordsId, "users!A:P", bypassCache);

    return userRows
      .slice(1)
      .map((row) => ({
        email: (row[USER_COL.EMAIL] || "").trim(),
        lastName: (row[USER_COL.LAST_NAME] || "").trim(),
        firstName: (row[USER_COL.FIRST_NAME] || "").trim(),
        middleName: (row[USER_COL.MIDDLE_NAME] || "").trim(),
        suffix: (row[USER_COL.SUFFIX] || "").trim(),
        overrideName: (row[USER_COL.OVERRIDE_NAME] || "").trim(),
        displayName: (row[USER_COL.DISPLAY_NAME] || "").trim(),
        displayNameFormal: (row[USER_COL.DISPLAY_NAME_FL] || "").trim(),
        studentNo: (row[USER_COL.STUDENT_NO] || "").trim(),
        secondaryContact: (row[USER_COL.SECONDARY_CONTACT] || "").trim(),
        address: (row[USER_COL.ADDRESS] || "").trim(),
        college: (row[USER_COL.COLLEGE] || "").trim(),
        program: (row[USER_COL.DEGREE_PROGRAM] || "").trim(),
        tags: (row[USER_COL.TAGS] || "").trim(),
        notes: (row[USER_COL.NOTES] || "").trim(),
        id: (row[USER_COL.ID] || "").trim(),
        raw: row
      }))
      .filter((u) => u.id !== "");
  },

  async isStudentNoTaken(studentNo: string): Promise<boolean> {
    if (!studentNo) {
      return false;
    }
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      return false;
    }
    const userRows = await fetchSheetRowsRaw(settings.residentRecordsId, "users!A:P");
    const needle = studentNo.trim().toLowerCase();
    if (!needle) {
      return false;
    }
    return userRows
      .slice(1)
      .some(
        (row) =>
          (row[USER_COL.STUDENT_NO] || "").trim().toLowerCase() === needle
      );
  },

  async updateUser(userId: string, data: Partial<UserRecord>): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }

    const rows = await fetchSheetRowsRaw(settings.residentRecordsId, "users!A:P");
    const rowIndex = rows.findIndex((r) => (r[USER_COL.ID] || "").trim() === userId);
    if (rowIndex === -1) {
      throw new Error("User not found");
    }

    const actualRow = rowIndex + 1;
    const currentRow = rows[rowIndex];

    const newRow = [...currentRow];
    if (data.email !== undefined) {
      newRow[USER_COL.EMAIL] = data.email.trim().toLowerCase();
    }
    if (data.lastName !== undefined) {
      newRow[USER_COL.LAST_NAME] = data.lastName.trim().toUpperCase();
    }
    if (data.firstName !== undefined) {
      newRow[USER_COL.FIRST_NAME] = data.firstName.trim().toUpperCase();
    }
    if (data.middleName !== undefined) {
      newRow[USER_COL.MIDDLE_NAME] = data.middleName.trim().toUpperCase();
    }
    if (data.suffix !== undefined) {
      newRow[USER_COL.SUFFIX] = data.suffix.trim().toUpperCase();
    }
    if (data.overrideName !== undefined) {
      newRow[USER_COL.OVERRIDE_NAME] = data.overrideName;
    }

    const computed = computeDisplayNames({
      firstName: data.firstName ?? currentRow[USER_COL.FIRST_NAME],
      lastName: data.lastName ?? currentRow[USER_COL.LAST_NAME],
      middleName: data.middleName ?? currentRow[USER_COL.MIDDLE_NAME],
      suffix: data.suffix ?? currentRow[USER_COL.SUFFIX]
    });

    newRow[USER_COL.DISPLAY_NAME] = computed.displayName;
    newRow[USER_COL.DISPLAY_NAME_FL] = computed.displayNameFormal;

    if (data.studentNo !== undefined) {
      newRow[USER_COL.STUDENT_NO] = data.studentNo;
    }
    if (data.secondaryContact !== undefined) {
      newRow[USER_COL.SECONDARY_CONTACT] = data.secondaryContact;
    }
    if (data.address !== undefined) {
      newRow[USER_COL.ADDRESS] = data.address;
    }
    if (data.college !== undefined) {
      newRow[USER_COL.COLLEGE] = data.college;
    }
    if (data.program !== undefined) {
      newRow[USER_COL.DEGREE_PROGRAM] = data.program;
    }
    if (data.tags !== undefined) {
      newRow[USER_COL.TAGS] = data.tags;
    }
    if (data.notes !== undefined) {
      newRow[USER_COL.NOTES] = data.notes;
    }

    await updateSheetValue(settings.residentRecordsId, `users!A${actualRow}:P${actualRow}`, [
      newRow
    ]);
  },

  async addUser(data: Partial<UserRecord>): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }

    const row = new Array(16).fill("");
    row[USER_COL.EMAIL] = (data.email || "").trim().toLowerCase();
    row[USER_COL.LAST_NAME] = (data.lastName || "").trim().toUpperCase();
    row[USER_COL.FIRST_NAME] = (data.firstName || "").trim().toUpperCase();
    row[USER_COL.MIDDLE_NAME] = (data.middleName || "").trim().toUpperCase();
    row[USER_COL.SUFFIX] = (data.suffix || "").trim().toUpperCase();
    row[USER_COL.OVERRIDE_NAME] = (data.overrideName || "").trim();

    const computed = computeDisplayNames(data);
    row[USER_COL.DISPLAY_NAME] = computed.displayName;
    row[USER_COL.DISPLAY_NAME_FL] = computed.displayNameFormal;

    row[USER_COL.STUDENT_NO] = data.studentNo || "";
    row[USER_COL.SECONDARY_CONTACT] = data.secondaryContact || "";
    row[USER_COL.ADDRESS] = data.address || "";
    row[USER_COL.COLLEGE] = data.college || "";
    row[USER_COL.DEGREE_PROGRAM] = data.program || "";
    row[USER_COL.TAGS] = data.tags || "";
    row[USER_COL.NOTES] = data.notes || "";
    row[USER_COL.ID] = data.id || crypto.randomUUID();

    await appendSheetRow(settings.residentRecordsId, "users!A:P", [row]);
  },

  async deleteUser(userId: string): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.residentRecordsId) {
      throw new Error("Resident Records ID not configured");
    }

    const rows = await fetchSheetRowsRaw(settings.residentRecordsId, "users!A:P");
    const rowIndex = rows.findIndex((r) => (r[USER_COL.ID] || "").trim() === userId);
    if (rowIndex === -1) {
      throw new Error("User not found in spreadsheet");
    }

    await deleteSheetRow(settings.residentRecordsId, "users", rowIndex);
  },

  async updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void> {
    const { settings } = await import("$state/settings.svelte");
    if (!settings.accountingWorkbookId) {
      throw new Error("Accounting workbook ID not configured");
    }

    const rows = await fetchSheetRowsRaw(settings.accountingWorkbookId, "accounts!A:C");
    const rowIndex = rows.findIndex(
      (r) =>
        r[ACCOUNT_COL.RESIDENT_ID]?.trim() === residentId &&
        r[ACCOUNT_COL.PERIOD]?.trim() === period
    );

    if (rowIndex === -1) {
      throw new Error("Resident not found in sheet");
    }

    const actualRow = rowIndex + 1;

    await batchUpdateValues(settings.accountingWorkbookId, [
      { range: `accounts!F${actualRow}`, values: [[data.refNo]] },
      { range: `accounts!G${actualRow}`, values: [[data.dateString]] },
      { range: `accounts!H${actualRow}`, values: [[data.publicLink]] },
      { range: `accounts!J${actualRow}`, values: [[data.issuerId]] }
    ]);
  },

  async registerResident(data: Record<string, any>): Promise<void> {
    const { fetchServer } = await import("$utils/api-client");
    await fetchServer("/api/resident/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
  }
};
