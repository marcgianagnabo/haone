import { getSheetsClient } from "$api/services/auth-service";
import { getSheetValues } from "$api/services/server-sheets-service";
import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import type { ReceiptData, ReceiptItem } from "$lib/types";
import { JOURNAL_COL, USER_COL } from "$lib/types";
import { parseCSVAmount } from "$utils/math";
import { isUuid } from "$utils/parsers";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  return {
    receiptData: null,
    id
  };
};

async function verifySheets(id: string, stno: string) {
  try {
    const client = await getSheetsClient();
    const [jorRows, userRows] = await Promise.all([
      getSheetValues(client, PUBLIC_GS_AW_ID, "journal_general!A:V"),
      PUBLIC_GS_RR_ID ? getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P") : Promise.resolve([])
    ]);
    const row = jorRows.slice(1).find((r: any) => r[JOURNAL_COL.ID] === id);

    if (!row) {
      return fail(404, { error: "Transaction record not found" });
    }

    const userMap = new Map<string, string[]>();
    userRows.slice(1).forEach((u: any) => {
      const uId = (u[USER_COL.ID] || "").trim();
      const uEmail = (u[USER_COL.EMAIL] || "").trim().toLowerCase();
      if (uId) {
        userMap.set(uId, u);
      }
      if (uEmail) {
        userMap.set(uEmail, u);
      }
    });

    const creatorId = (row[JOURNAL_COL.CREATOR_ID] || "").trim();
    const creatorRaw = (row[JOURNAL_COL.CREATOR] || "").trim();
    const creatorUser =
      (creatorId ? userMap.get(creatorId) : undefined) ||
      (creatorRaw ? userMap.get(creatorRaw.toLowerCase()) : undefined);
    const receivedBy = creatorUser
      ? (creatorUser[USER_COL.DISPLAY_NAME] || "").trim()
      : row[JOURNAL_COL.CREATOR_NAME] || "N/A";

    const accountId = (row[JOURNAL_COL.ACCOUNT_ID] || "").trim();
    const accountRaw = (row[JOURNAL_COL.ACCOUNT] || "").trim();
    const accountUser =
      (accountId ? userMap.get(accountId) : undefined) ||
      (accountRaw ? userMap.get(accountRaw.toLowerCase()) : undefined);
    const receivedFrom = accountUser
      ? (accountUser[USER_COL.DISPLAY_NAME] || "").trim()
      : row[JOURNAL_COL.NAME] || "N/A";
    const correctStNo = accountUser
      ? (accountUser[USER_COL.STUDENT_NO] || "").trim()
      : (row[JOURNAL_COL.STNO] || "").toString().trim();

    if (stno === correctStNo) {
      // Build receipt data to return directly
      const prRefNo = row[JOURNAL_COL.PR_REFNO];
      const items: ReceiptItem[] = [];
      const water = parseCSVAmount(row[JOURNAL_COL.WATER]);
      const assoc = parseCSVAmount(row[JOURNAL_COL.ASSOC]);
      const misc = parseCSVAmount(row[JOURNAL_COL.MISC]);

      if (water !== 0) {
        items.push({ name: "Water Fee", amount: water });
      }
      if (assoc !== 0) {
        items.push({ name: "Association Fee", amount: assoc });
      }
      if (misc !== 0) {
        items.push({ name: "Miscellaneous", amount: misc });
      }

      const receiptData: ReceiptData = {
        dateIssued: row[JOURNAL_COL.PR_DATE_ISSUED] || new Date().toISOString().split("T")[0],
        paymentDate: row[JOURNAL_COL.DATE],
        processor: row[JOURNAL_COL.MOP],
        referenceNumber: row[JOURNAL_COL.MOP_REFNO] || "N/A",
        period: row[JOURNAL_COL.PERIOD],
        seriesNumber: prRefNo,
        receivedFrom,
        receivedBy,
        notes: row[JOURNAL_COL.NOTES],
        transactionType: row[JOURNAL_COL.TYPE],
        branding: "default",
        stno: correctStNo || "",
        items
      };

      return { success: true, receiptData };
    }

    return fail(401, { error: "Student number does not match this record" });
  } catch (e: any) {
    console.error("Verification action failed:", e);
    return fail(500, { error: "Internal verification error" });
  }
}

async function verifySupabase(id: string, stno: string) {
  if (!isUuid(id)) {
    return fail(404, { error: "Transaction record not found" });
  }

  try {
    const sb = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await sb.rpc("get_receipt_by_id", { txn_id: id });

    if (error) {
      console.error("Verification action failed:", error);
      return fail(500, { error: "Internal verification error" });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) {
      return fail(404, { error: "Transaction record not found" });
    }

    const correctStNo = (row.account_stno || "").toString().trim();
    if (stno !== correctStNo) {
      return fail(401, { error: "Student number does not match this record" });
    }

    const items: ReceiptItem[] = [];
    const water = parseCSVAmount(row.water);
    const assoc = parseCSVAmount(row.assoc);
    const misc = parseCSVAmount(row.misc);
    const maintenance = parseCSVAmount(row.maintenance);
    const gas = parseCSVAmount(row.gas);

    if (water !== 0) {
      items.push({ name: "Water Fee", amount: water });
    }
    if (assoc !== 0) {
      items.push({ name: "Association Fee", amount: assoc });
    }
    if (misc !== 0) {
      items.push({ name: "Miscellaneous", amount: misc });
    }
    if (maintenance !== 0) {
      items.push({ name: "Maintenance Fee", amount: maintenance });
    }
    if (gas !== 0) {
      items.push({ name: "Gas Fee", amount: gas });
    }

    const receiptData: ReceiptData = {
      dateIssued: row.pr_date_issued
        ? String(row.pr_date_issued).slice(0, 10)
        : new Date().toISOString().split("T")[0],
      paymentDate: row.date ? String(row.date).slice(0, 10) : "",
      processor: row.mop || "",
      referenceNumber: row.mop_ref_no || "N/A",
      period: row.period || "",
      seriesNumber: row.pr_ref_no || "",
      receivedFrom: row.account_name || "N/A",
      receivedBy: row.creator_name || "N/A",
      notes: row.notes || "",
      transactionType: row.type || "",
      branding: "default",
      stno: correctStNo,
      items
    };

    return { success: true, receiptData };
  } catch (e: any) {
    console.error("Verification action failed:", e);
    return fail(500, { error: "Internal verification error" });
  }
}

export const actions: Actions = {
  verify: async ({ request, params }) => {
    const formData = await request.formData();
    const stno = formData.get("stno")?.toString().trim();
    const id = params.id;

    if (!stno || !id) {
      return fail(400, { error: "Missing verification data" });
    }

    if (PUBLIC_DB_PROVIDER === "supabase") {
      return await verifySupabase(id, stno);
    }
    return await verifySheets(id, stno);
  }
};