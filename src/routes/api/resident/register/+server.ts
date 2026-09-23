import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { appendSheetValue, getSheetValues, serverError } from "$api/services/server-sheets-service";
import { PUBLIC_GS_AW_ID, PUBLIC_GS_RR_ID } from "$env/static/public";
import { AccountType, CURR_COL } from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const { email: authEmail, error: authError } = await authenticateResident(request);
  if (authError) return authError;

  try {
    const data = await request.json();
    const {
      email,
      firstName,
      lastName,
      studentNo,
      college,
      program,
      room,
      bed,
      checkInDate,
      accountType,
      suffix,
      overrideName
    } = data;

    const targetEmail = (authEmail || email).toLowerCase();
    if (!targetEmail) {
      return json({ error: "Missing email" }, { status: 400 });
    }

    const resolvedAccountType = accountType || AccountType.STUDENT;

    if (!targetEmail.endsWith("@up.edu.ph") && resolvedAccountType === AccountType.STUDENT) {
      return json(
        { error: "Only @up.edu.ph email addresses are allowed for student accounts." },
        { status: 400 }
      );
    }

    const client = await getSheetsClient();

    // Fetch Constants to get TERM_CURR
    const constRows = await getSheetValues(client, PUBLIC_GS_AW_ID, "constants!A:C");
    const activeTerm =
      constRows.find((r: any) => {
        return r[0] === "TERM_CURR";
      })?.[1] || "";

    // Generate random code for temporary student number if resident is not a student
    // and the student number field is empty
    let finalStudentNo = studentNo;
    if (resolvedAccountType !== AccountType.STUDENT && !studentNo) {
      const randomUuid = crypto.randomUUID();
      finalStudentNo = `${resolvedAccountType}-${activeTerm}-${randomUuid}`;
    }

    // Append to CURR sheet (15 columns now)
    const newRow = new Array(15).fill("");
    newRow[CURR_COL.TIMESTAMP] = new Date().toISOString();
    newRow[CURR_COL.EMAIL] = targetEmail;
    newRow[CURR_COL.ROOM] = room;
    newRow[CURR_COL.BED] = bed;
    newRow[CURR_COL.LAST_NAME] = (lastName || "").trim().toUpperCase();
    newRow[CURR_COL.FIRST_NAME] = (firstName || "").trim().toUpperCase();
    newRow[CURR_COL.COLLEGE] = college;
    newRow[CURR_COL.PROGRAM] = program;
    newRow[CURR_COL.STUDENT_NO] = finalStudentNo;
    newRow[CURR_COL.CHECK_IN_DATE] = checkInDate || "";
    newRow[CURR_COL.EVALUATED] = "FALSE";
    newRow[CURR_COL.TERM] = activeTerm;
    newRow[CURR_COL.ACCOUNT_TYPE] = resolvedAccountType;
    newRow[CURR_COL.SUFFIX] = (suffix || "").trim().toUpperCase();
    newRow[CURR_COL.OVERRIDE_NAME] = (overrideName || "").trim().toUpperCase();

    await appendSheetValue(client, PUBLIC_GS_RR_ID, "CURR!A:O", [newRow]);

    return json({ success: true });
  } catch (e: any) {
    return serverError(e, "Registration");
  }
};
