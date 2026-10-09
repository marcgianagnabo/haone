import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { fetchSheetsData, serverError } from "$api/services/server-sheets-service";
import {
  ACCOUNT_COL,
  CURR_COL,
  JOURNAL_COL,
  TRANSACTION_TYPE_CONFIG,
  TransactionType,
  USER_COL
} from "$lib/types";
import { parseCSVAmount } from "$utils/math";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url, request }) => {
  const { email, error } = await authenticateResident(request);
  if (error) return error;

  try {
    const client = await getSheetsClient();

    // 1. Fetch all relevant sheets data
    const [constRows, userRows, jorRows, accRows, currRows] = await fetchSheetsData(client, [
      "constants!A:C",
      "users!A:Q",
      "journal_general!A:V",
      "accounts!A:L",
      "CURR!A:P"
    ]);

    // 2. Resolve active term and user row
    const activeTerm = constRows.find((r: any) => r[0] === "TERM_CURR")?.[1] || "";
    const userRow = userRows.find((r: any) => (r[USER_COL.EMAIL] || "").toLowerCase() === email);
    const userId = userRow ? (userRow[USER_COL.ID] || "").trim() : "";

    // 3. Fetch MOPs
    const mopTypes = constRows
      .slice(1)
      .filter((r: any) => {
        const key = (r[0] || "").trim();
        return key.startsWith("MOP_");
      })
      .map((r: any) => ({
        value: r[1] || r[0],
        label: r[2] || r[1] || r[0]
      }));

    // 4. Determine current resident account
    const targetTerm = url.searchParams.get("term") || activeTerm;
    const residentAccount = accRows.slice(1).find((r: any) => {
      return (
        r[ACCOUNT_COL.PERIOD] === targetTerm &&
        userRow &&
        r[ACCOUNT_COL.RESIDENT_ID] === userRow[USER_COL.ID]
      );
    });

    // 5. Check CURR sheet for potential registration (filter by term)
    const currEntry = [...currRows]
      .reverse()
      .find(
        (r: any) =>
          (r[CURR_COL.EMAIL] || "").trim().toLowerCase() === email &&
          (r[CURR_COL.TERM] || "") === activeTerm
      );
    const isEvaluated = currEntry?.[CURR_COL.EVALUATED]?.toUpperCase() === "TRUE";

    // 6. Fetch Transactions
    const matchesUser = (r: any) => {
      const acc = (r[JOURNAL_COL.ACCOUNT] || "").trim().toLowerCase();
      const accId = (r[JOURNAL_COL.ACCOUNT_ID] || "").trim().toLowerCase();
      return (
        (userId && accId === userId.toLowerCase()) ||
        (userId && acc === userId.toLowerCase()) ||
        (email && acc === email)
      );
    };

    const transactions = jorRows
      .slice(1)
      .filter(
        (r: any) =>
          matchesUser(r) &&
          (!url.searchParams.get("term") || r[JOURNAL_COL.PERIOD] === url.searchParams.get("term"))
      )
      .map((r: any, idx: number) => ({
        id: r[JOURNAL_COL.ID] || `tr-${idx}`,
        date: r[JOURNAL_COL.DATE],
        type: r[JOURNAL_COL.TYPE],
        amount:
          parseCSVAmount(r[JOURNAL_COL.WATER]) +
          parseCSVAmount(r[JOURNAL_COL.ASSOC]) +
          parseCSVAmount(r[JOURNAL_COL.MISC]),
        period: r[JOURNAL_COL.PERIOD],
        mop: r[JOURNAL_COL.MOP],
        notes: r[JOURNAL_COL.NOTES],
        creator: r[JOURNAL_COL.CREATOR],
        prRefNo: r[JOURNAL_COL.PR_REFNO]
      }));

    // Calculate running balances
    let globalBalance = 0;
    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    for (const t of sortedTransactions) {
      if (!t.type.toUpperCase().includes("WAIVED")) {
        globalBalance += t.amount;
      }
      t.runningBalance = globalBalance;
    }

    // 7. Get all available terms from constants and resident journal
    const constTerms = constRows
      .slice(1)
      .filter((r: any) => {
        const k = (r[0] || "").trim();
        return k.startsWith("TERM_") && k !== "TERM_CURR" && k !== "TERM_RESERVED";
      })
      .map((r: any) => (r[1] || "").trim())
      .filter(Boolean);

    const journalTerms = jorRows
      .slice(1)
      .filter((r: any) => matchesUser(r))
      .map((r: any) => (r[JOURNAL_COL.PERIOD] || "").trim())
      .filter(Boolean);

    const allTerms = Array.from(new Set([...constTerms, ...journalTerms, activeTerm])).filter(
      Boolean
    );

    // Calculate financials
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;

    const filteredJor = jorRows
      .slice(1)
      .filter((r: any) => matchesUser(r) && r[JOURNAL_COL.PERIOD] === targetTerm);

    const waterPaid = filteredJor
      .filter((j: any) => j[JOURNAL_COL.TYPE] !== pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j[JOURNAL_COL.WATER]), 0);
    const waterWaived = filteredJor
      .filter((j: any) => j[JOURNAL_COL.TYPE] === pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j[JOURNAL_COL.WATER]), 0);

    const assocPaid = filteredJor
      .filter((j: any) => j[JOURNAL_COL.TYPE] !== pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j[JOURNAL_COL.ASSOC]), 0);
    const assocWaived = filteredJor
      .filter((j: any) => j[JOURNAL_COL.TYPE] === pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j[JOURNAL_COL.ASSOC]), 0);

    const getConstVal = (key: string) => constRows.find((r: any) => r[0] === key)?.[1] || "0";
    const waterBase = parseCSVAmount(getConstVal(`FEES_${targetTerm}_WATER`));
    const assocBase = parseCSVAmount(getConstVal(`FEES_${targetTerm}_ASSOC`));

    const totalBase = waterBase + assocBase;
    const paid = waterPaid + assocPaid;
    const waived = waterWaived + assocWaived;
    const bal = totalBase - paid - waived;

    return json({
      isRegistered: !!userRow,
      hasActiveAccount: !!residentAccount,
      waitingForConfirmation: !!(currEntry && !isEvaluated),
      activeTerm: url.searchParams.get("term") || activeTerm,
      systemActiveTerm: activeTerm,
      allTerms: allTerms.sort().reverse(),
      mopTypes,
      profile: userRow
        ? {
            id: userRow[USER_COL.ID],
            email: userRow[USER_COL.EMAIL],
            firstName: userRow[USER_COL.FIRST_NAME],
            lastName: userRow[USER_COL.LAST_NAME],
            studentNo: userRow[USER_COL.STUDENT_NO],
            college: (userRow[USER_COL.COLLEGE] || "").split(",").pop()?.trim() || "",
            program: (userRow[USER_COL.DEGREE_PROGRAM] || "").split(":").pop()?.trim() || "",
            tags: userRow[USER_COL.TAGS] || "",
            suffix: userRow[USER_COL.SUFFIX] || "",
            overrideName: userRow[USER_COL.OVERRIDE_NAME] || "",
            avatarUrl: (userRow[USER_COL.AVATAR_URL] || "").trim()
          }
        : null,
      account: residentAccount
        ? {
            email: (userRow?.[USER_COL.EMAIL] || "").trim(),
            period: (residentAccount[ACCOUNT_COL.PERIOD] || "").trim(),
            room: (residentAccount[ACCOUNT_COL.ROOM] || "").trim(),
            bed: (residentAccount[ACCOUNT_COL.BED] || "").trim(),
            checkInDate: (residentAccount[ACCOUNT_COL.CHECK_IN_DATE] || "").trim(),
            name: (userRow?.[USER_COL.DISPLAY_NAME] || "").trim(),
            stno: (userRow?.[USER_COL.STUDENT_NO] || "").trim(),
            waterBase,
            waterPaid,
            waterWaived,
            waterBal: waterBase - waterPaid - waterWaived,
            assocBase,
            assocPaid,
            assocWaived,
            assocBal: assocBase - assocPaid - assocWaived,
            totalBase,
            paid,
            waived,
            bal,
            isFullyPaid: bal <= 0,
            ceRefNo: (residentAccount[ACCOUNT_COL.CE_REFNO] || "").trim(),
            ceIssued: (residentAccount[ACCOUNT_COL.CE_ISSUED] || "").trim(),
            ceLink: (residentAccount[ACCOUNT_COL.CE_LINK] || "").trim(),
            college: (userRow?.[USER_COL.COLLEGE] || "").split(",").pop()?.trim() || "",
            program: (userRow?.[USER_COL.DEGREE_PROGRAM] || "").split(":").pop()?.trim() || "",
            type: (residentAccount[ACCOUNT_COL.TYPE] || "").trim().toUpperCase()
          }
        : null,
      currEntry: currEntry
        ? {
            room: currEntry[CURR_COL.ROOM],
            bed: currEntry[CURR_COL.BED],
            lastName: currEntry[CURR_COL.LAST_NAME],
            firstName: currEntry[CURR_COL.FIRST_NAME],
            college: currEntry[CURR_COL.COLLEGE],
            program: currEntry[CURR_COL.PROGRAM],
            studentNo: currEntry[CURR_COL.STUDENT_NO],
            accountType: (currEntry[CURR_COL.ACCOUNT_TYPE] || "").trim().toUpperCase(),
            suffix: currEntry[CURR_COL.SUFFIX] || "",
            overrideName: currEntry[CURR_COL.OVERRIDE_NAME] || "",
            declineReason: currEntry[CURR_COL.DECLINE_REASON] || "",
            isEvaluated
          }
        : null,
      transactions: sortedTransactions.reverse(),
      occupiedBeds: accRows
        .filter(
          (r: any) =>
            r[ACCOUNT_COL.PERIOD] === targetTerm &&
            r[ACCOUNT_COL.ROOM] &&
            r[ACCOUNT_COL.BED] &&
            (!userRow || r[ACCOUNT_COL.RESIDENT_ID] !== userRow[USER_COL.ID])
        )
        .map((r: any) => ({
          room: (r[ACCOUNT_COL.ROOM] || "").trim(),
          bed: (r[ACCOUNT_COL.BED] || "").trim()
        }))
    });
  } catch (e: any) {
    return serverError(e, "Status check");
  }
};
