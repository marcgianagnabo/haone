import { getSheetsClient } from "$api/services/auth-service";
import { getSheetValues } from "$api/services/server-sheets-service";
import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_GS_AW_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import { ACCOUNT_COL, OFFICER_COL, USER_COL } from "$lib/types";
import { parseDbUuid } from "$utils/parsers";
import { matchesStudentNo } from "$utils/student-no";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  return {
    clearanceData: null,
    id
  };
};

async function verifySheets(id: string, stno: string) {
  try {
    const client = await getSheetsClient();
    const accRows = await getSheetValues(client, PUBLIC_GS_AW_ID, "accounts!A:K");
    const row = accRows.slice(1).find((r: any) => r[ACCOUNT_COL.CE_REFNO] === id);

    if (!row) {
      return fail(404, { error: "Clearance record not found" });
    }

    const resId = row[ACCOUNT_COL.RESIDENT_ID];
    const userRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "users!A:P");
    const user = userRows.find((u: any) => u[USER_COL.ID] === resId);

    if (!user) {
      return fail(404, { error: "Resident profile not found" });
    }

    const correctStNo = (user[USER_COL.STUDENT_NO] || "").toString().trim();
    if (matchesStudentNo(stno, correctStNo)) {
      // Resolve Signatory Info
      const issuerId = row[9]; // Column J (ISSUER_ID)
      const period = row[ACCOUNT_COL.PERIOD];

      let signatory = "HOUSE COUNCIL OFFICER";
      let signatoryTitle = "Officer";

      if (issuerId) {
        const issuerUser = userRows.find((u: any) => u[USER_COL.ID] === issuerId);
        if (issuerUser) {
          signatory = issuerUser[USER_COL.DISPLAY_NAME_FL] || issuerUser[USER_COL.DISPLAY_NAME];

          // Cross-reference Directory for Position
          const issuerEmail = (issuerUser[USER_COL.EMAIL] || "").toLowerCase();
          const directoryRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "directory!A:J");
          const officer = directoryRows.find(
            (r: any) =>
              (r[OFFICER_COL.EMAIL] || "").toLowerCase() === issuerEmail &&
              r[OFFICER_COL.TERM] === period
          );

          if (officer) {
            signatoryTitle = officer[OFFICER_COL.POSITION];
          }
        }
      }

      // Build clearance data
      const clearanceData = {
        name: user[USER_COL.DISPLAY_NAME_FL] || user[USER_COL.DISPLAY_NAME],
        stno: correctStNo,
        period: period,
        dateIssued: row[ACCOUNT_COL.CE_ISSUED],
        refNo: row[ACCOUNT_COL.CE_REFNO],
        branding: "default",
        signatory,
        signatoryTitle
      };

      return { success: true, clearanceData };
    }

    return fail(401, { error: "Student number does not match this record" });
  } catch (e: any) {
    console.error("Verification action failed:", e);
    return fail(500, { error: "Internal verification error" });
  }
}

async function verifySupabase(id: string, stno: string) {
  if (!parseDbUuid(id)) {
    return fail(404, { error: "Clearance record not found" });
  }

  try {
    const sb = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await sb.rpc("get_clearance_by_refno", { refno: id });

    if (error) {
      console.error("Verification action failed:", error);
      return fail(500, { error: "Internal verification error" });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) {
      return fail(404, { error: "Clearance record not found" });
    }

    const correctStNo = (row.account_stno || "").toString().trim();
    if (!matchesStudentNo(stno, correctStNo)) {
      return fail(401, { error: "Student number does not match this record" });
    }

    const clearanceData = {
      name: row.account_name || "Resident",
      stno: correctStNo,
      period: row.period || "",
      dateIssued: row.ce_issued || "",
      refNo: row.ref_no || id,
      branding: "default",
      signatory: row.signatory || "HOUSE COUNCIL OFFICER",
      signatoryTitle: row.signatory_title || "Officer"
    };

    return { success: true, clearanceData };
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
