import { canAccessAchievements } from "$api/controllers/resident-controller";
import {
  authenticateResident,
  getSheetsClient,
  resolveResidentAccountType
} from "$api/services/auth-service";
import { fetchSheetsData, serverError } from "$api/services/server-sheets-service";
import {
  ACCOUNT_COL,
  AccountType,
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  CURR_COL,
  USER_COL
} from "$lib/types";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => {
  const {
    residentId,
    email: authEmail,
    isInstanceAdmin,
    error
  } = await authenticateResident(request);
  if (error) {
    return error;
  }

  try {
    let isAdmin = !!isInstanceAdmin;

    const client = await getSheetsClient();
    const [achRows, logRows, userRows, accRows, activeTerm, currRows, dirRows] =
      await fetchSheetsData(client, [
        "achievements!A:H",
        "achievement_records!A:F",
        "users!A:P",
        "accounts!A:L",
        "TERM_CURR",
        "CURR!A:O",
        "directory!A:D"
      ]);

    if (!isAdmin) {
      const isOfficer = dirRows
        .slice(1)
        .some((r: any) => (r[3] || "").trim().toLowerCase() === (authEmail || "").toLowerCase());
      if (isOfficer) {
        isAdmin = true;
      }
    }

    const currentResidentId = residentId;
    if (!currentResidentId && !isAdmin) {
      return json({ achievements: [], logs: [], currentResidentId: "" });
    }

    const userRow = userRows.find((r: any) => (r[USER_COL.ID] || "").trim() === currentResidentId);
    const email = (userRow?.[USER_COL.EMAIL] || "").trim().toLowerCase();

    const currEntry = currRows
      .slice()
      .reverse()
      .find(
        (r: any) =>
          (r[CURR_COL.EMAIL] || "").trim().toLowerCase() === email &&
          (r[CURR_COL.TERM] || "") === activeTerm
      );

    const isAlum = currEntry?.[CURR_COL.ACCOUNT_TYPE] === AccountType.ALUMNUS;

    let accountType = isAlum
      ? AccountType.ALUMNUS
      : resolveResidentAccountType(accRows, activeTerm, currentResidentId);

    if (!accountType && !isAdmin) {
      return json(
        { error: "Access Denied: Resident does not have an account for the current term" },
        { status: 403 }
      );
    }

    if (accountType && !canAccessAchievements(accountType) && !isAdmin) {
      return json(
        { error: "Access Denied: Account type cannot access achievements" },
        { status: 403 }
      );
    }

    const accountsCountMap = new Map();
    accRows.slice(1).forEach((r: any) => {
      const term = (r[ACCOUNT_COL.PERIOD] || "").trim();
      if (term) {
        accountsCountMap.set(term, (accountsCountMap.get(term) || 0) + 1);
      }
    });
    const totalUsersCount = userRows.slice(1).length;

    const achievements = achRows.slice(1).map((row: any) => {
      const term = (row[ACHIEVEMENT_COL.TERM] || "").trim();
      const eligibleCount = term ? accountsCountMap.get(term) || 0 : totalUsersCount;
      return {
        id: (row[ACHIEVEMENT_COL.ID] || "").trim(),
        creatorId: (row[ACHIEVEMENT_COL.CREATOR_ID] || "").trim(),
        name: (row[ACHIEVEMENT_COL.NAME] || "").trim(),
        description: (row[ACHIEVEMENT_COL.DESCRIPTION] || "").trim(),
        icon: (row[ACHIEVEMENT_COL.ICON] || "").trim(),
        extraUrl: (row[ACHIEVEMENT_COL.EXTRA_URL] || "").trim(),
        term: term,
        points: Number(row[ACHIEVEMENT_COL.POINTS] || 0),
        totalEligibleCount: eligibleCount
      };
    });

    const userMap = new Map<string, string>();
    userRows.slice(1).forEach((r: any) => {
      userMap.set((r[USER_COL.ID] || "").trim(), (r[USER_COL.DISPLAY_NAME] || "").trim());
    });

    // Privacy toggle removed: earner names are always shown.
    const logs = logRows.slice(1).map((row: any) => {
      const accountId = (row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] || "").trim();

      return {
        id: (row[ACHIEVEMENT_RECORD_COL.ID] || "").trim(),
        accountId,
        achievementId: (row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] || "").trim(),
        date: (row[ACHIEVEMENT_RECORD_COL.DATE] || "").trim(),
        term: (row[ACHIEVEMENT_RECORD_COL.TERM] || "").trim(),
        displayName: userMap.get(accountId) || "Resident",
        isPublic: true
      };
    });

    let displayedAchievements = achievements;
    if (accountType === AccountType.ALUMNUS && !isAdmin) {
      const earnedIds = new Set(
        logs
          .filter((log: any) => log.accountId === currentResidentId)
          .map((log: any) => log.achievementId)
      );
      displayedAchievements = achievements.filter((a: any) => earnedIds.has(a.id));
    }

    return json({ achievements: displayedAchievements, logs, currentResidentId, isAdmin });
  } catch (e: any) {
    return serverError(e, "Achievements fetch");
  }
};
