import { authenticateResident, getSheetsClient } from "$api/services/auth-service";
import { fetchSheetsData, serverError } from "$api/services/server-sheets-service";
import { ACCOUNT_COL, OFFICER_COL, USER_COL } from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const { error } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    const client = await getSheetsClient();
    const [rows, currentTerm, userRows, accRows] = await fetchSheetsData(client, [
      "directory!A:L",
      "TERM_CURR",
      "users!A:Z",
      "accounts!A:Z"
    ]);

    const emailToUser = new Map();
    userRows.slice(1).forEach((r: any) => {
      const email = (r[USER_COL.EMAIL] || "").toLowerCase().trim();
      if (email) {
        emailToUser.set(email, r);
      }
    });

    const resLookupToRoom = new Map();
    accRows.slice(1).forEach((r: any) => {
      const resId = (r[ACCOUNT_COL.RESIDENT_ID] || "").trim();
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (resId && (term === currentTerm || !term)) {
        resLookupToRoom.set(resId, (r[ACCOUNT_COL.ROOM] || "").trim());
      }
    });

    const officers = rows
      .slice(1)
      .filter((row: any) => {
        const term = (row[OFFICER_COL.TERM] || "").trim();
        const status = (row[OFFICER_COL.STATUS] || "ACTIVE").trim();
        return term === currentTerm && status === "ACTIVE";
      })
      .map((row: any) => {
        const email = (row[OFFICER_COL.EMAIL] || "").toLowerCase().trim();
        const user = emailToUser.get(email);

        // Try to find room by ID first, then by Email
        let room = null;
        if (user) {
          room = resLookupToRoom.get(String(user[USER_COL.ID]).trim());
          if (!room) {
            room = resLookupToRoom.get(email);
          }
        } else {
          room = resLookupToRoom.get(email);
        }

        let committee = (row[OFFICER_COL.COMMITTEE] || "").trim();
        if (committee.toUpperCase() === "N/A" || committee === "None") {
          committee = "";
        }

        const photoOverride = (row[OFFICER_COL.PHOTO] || "").trim();
        const photoAuto = (row[OFFICER_COL.PHOTO_AUTO] || "").trim();
        const userAvatar = user ? (user[USER_COL.AVATAR_URL] || "").trim() : "";

        return {
          position: (row[OFFICER_COL.POSITION] || "").trim(),
          name: (row[OFFICER_COL.NAME] || "").trim(),
          nickname: (row[OFFICER_COL.NICKNAME] || "").trim(),
          committee,
          room: room || "N/A",
          fbLink: (row[OFFICER_COL.FB_LINK] || "").trim(),
          photoUrl: photoOverride || photoAuto || userAvatar || ""
        };
      });

    return json(officers);
  } catch (e: any) {
    return serverError(e, "Officers fetch");
  }
};
