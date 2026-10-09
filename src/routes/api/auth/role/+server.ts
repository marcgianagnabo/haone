import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { getSheetValues, serverError } from "$api/services/server-sheets-service";
import { PUBLIC_DB_PROVIDER, PUBLIC_GS_RR_ID } from "$env/static/public";
import { OFFICER_COL } from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET: Whether the signed-in email belongs to an officer.
 *
 * Sheets backend only — resolved here with the service account. Supabase
 * callers check the officers table directly with their own session (RLS
 * already permits the read), so this route is never needed there. The email
 * comes from the verified credential JWT, never from client input. A false
 * result only hides the workspace picker; admin enforcement stays
 * server-side (RLS / route guards).
 */
export const GET: RequestHandler = async ({ request }) => {
  const { email: authEmail, error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    if (PUBLIC_DB_PROVIDER === "supabase") {
      return json({ isOfficer: false, unsupported: true });
    }

    const client = await getSheetsClient();
    const dirRows = await getSheetValues(client, PUBLIC_GS_RR_ID, "directory!A:H");
    const isOfficer = dirRows
      .slice(1)
      .some((r: any) => (r[OFFICER_COL.EMAIL] || "").toLowerCase().trim() === authEmail);

    return json({ isOfficer });
  } catch (e: any) {
    return serverError(e, "Role check");
  }
};
