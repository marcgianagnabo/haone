import { getSheetsClient } from "$api/services/auth-service";
import { fetchSheetsData } from "$api/services/server-sheets-service";
import { JOURNAL_COL, USER_COL } from "$lib/types";
import { matchesStudentNo } from "$utils/student-no";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { pr_refno, stno } = await request.json();

    if (!pr_refno || !stno) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const token = await getSheetsClient();
    const [jorRows, userRows] = await fetchSheetsData(token, ["journal_general!A:V", "users!A:P"]);

    const userMap = new Map<string, string>();
    userRows.slice(1).forEach((u: any) => {
      userMap.set((u[USER_COL.ID] || "").trim(), (u[USER_COL.STUDENT_NO] || "").trim());
    });

    const targetStno = stno.trim();

    const row = jorRows.slice(1).find((r: any) => {
      if (r[JOURNAL_COL.PR_REFNO] !== pr_refno) {
        return false;
      }
      const accountId = (r[JOURNAL_COL.ACCOUNT_ID] || "").trim();
      const resolvedStno = accountId ? userMap.get(accountId) : "";
      return matchesStudentNo(targetStno, resolvedStno);
    });

    if (!row) {
      return json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    const secretId = row[JOURNAL_COL.ID];
    if (!secretId) {
      return json({ error: "Internal ID missing for this transaction" }, { status: 500 });
    }

    return json({ id: secretId });
  } catch (e: any) {
    console.error("Receipt claim failed:", e);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
