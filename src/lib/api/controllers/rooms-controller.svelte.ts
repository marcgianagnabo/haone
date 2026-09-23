import { addJournalEntries } from "$api/controllers/journal-controller";
import {
  addUser,
  fetchResidents,
  fetchUsers,
  updateUser
} from "$api/controllers/resident-controller";
import { roomsService, type AccountRow, type CurrRecord } from "$api/services/rooms-service";
import {
  AccountType,
  TRANSACTION_TYPE_CONFIG,
  TransactionType,
  UserTag,
  type UserRecord
} from "$lib/types";
import { auth } from "$state/auth.svelte";
import { roomsState } from "$state/rooms.svelte";
import { getLocalDateString } from "$utils/parsers";

export type { CurrRecord };

export interface SyncPreviewAction {
  type: "CREATE_USER" | "UPDATE_USER" | "CREATE_ACCOUNT" | "UPDATE_ACCOUNT" | "EVALUATE_ONLY";
  residentName: string;
  email: string;
  studentNo: string;
  college: string;
  program: string;
  room: string;
  bed: string;
  checkInDate: string;
  accountType: string;
  details: string;
  warning?: string;
  from?: string;
  to?: string;
  currIndex?: number; // Position of the CURR record this action originated from (dedup only)
  // Payload for applying
  payload: any;
}

export async function fetchCurrSheet(bypassCache = false): Promise<CurrRecord[]> {
  return roomsService.fetchCurrRecords(bypassCache);
}

export async function getSyncPreview(currentTerm: string): Promise<SyncPreviewAction[]> {
  const [currRecords, users, accounts] = await Promise.all([
    fetchCurrSheet(true),
    fetchUsers(true),
    roomsService.fetchAccounts(true)
  ]);

  const userMapByStNo = new Map<string, UserRecord>();
  const userMapByEmail = new Map<string, UserRecord>();
  users.forEach((u) => {
    if (u.studentNo) userMapByStNo.set(u.studentNo, u);
    if (u.email) userMapByEmail.set(u.email.toLowerCase(), u);
  });

  // Map: residentId -> account
  const existingAccountMap = new Map<string, AccountRow>();
  // Map: room-bed -> residentName
  const currentOccupancyMap = new Map<string, string>();

  accounts.forEach((acc) => {
    if (acc.period === currentTerm) {
      existingAccountMap.set(acc.residentId, acc);

      if (acc.room && acc.bed) {
        const user = users.find((u) => u.id === acc.residentId);
        const name = user ? `${user.lastName}, ${user.firstName}` : "Unknown";
        currentOccupancyMap.set(`${acc.room}-${acc.bed}`, name);
      }
    }
  });

  const plannedOccupancyMap = new Map<string, string>();
  const actions: SyncPreviewAction[] = [];
  // For tracking users planned to be created in this preview session
  const plannedUsersByStNo = new Map<string, string>();
  const plannedUsersByEmail = new Map<string, string>();

  for (const curr of currRecords) {
    if (curr.isEvaluated) continue;
    if (curr.term !== currentTerm) continue;
    if (!curr.studentNo && !curr.email) continue;

    let user = userMapByStNo.get(curr.studentNo) || userMapByEmail.get(curr.email);
    let userId = user?.id;
    // A matched users row may be a blank placeholder (no names yet). Fall back
    // to the registration's names so the admin can see who this is.
    let residentName =
      user && (user.lastName || user.firstName)
        ? `${(user.lastName || "").toUpperCase()}, ${(user.firstName || "").toUpperCase()}`
        : `${(curr.lastName || "").toUpperCase()}, ${(curr.firstName || "").toUpperCase()}`;

    const isEmptyRoomBed =
      !curr.room ||
      !curr.bed ||
      curr.room === "NONE" ||
      curr.bed === "NONE" ||
      curr.room === "N/A" ||
      curr.bed === "N/A";

    // Check if target room is valid/available
    const targetRoom = roomsState.config.find((r) => r.room_number === curr.room);
    let warning = "";
    if (!isEmptyRoomBed) {
      if (!targetRoom) {
        warning = `Room ${curr.room} not found in configuration.`;
      } else if (targetRoom.unavailable_reason) {
        warning = `Room ${curr.room} is marked as unavailable: ${targetRoom.unavailable_reason}`;
      } else if (curr.room && curr.bed) {
        const loc = `${curr.room}-${curr.bed}`;
        const occupant = currentOccupancyMap.get(loc);
        if (occupant && occupant !== residentName) {
          warning = `Bed ${loc} is currently occupied by ${occupant} in ${currentTerm}.`;
        } else if (plannedOccupancyMap.has(loc)) {
          warning = `Bed ${loc} is already assigned to ${plannedOccupancyMap.get(loc)} in this sync.`;
        } else {
          plannedOccupancyMap.set(loc, residentName);
        }
      }
    }

    if (!user) {
      // Check if we already planned to create this user
      let userId = plannedUsersByStNo.get(curr.studentNo) || plannedUsersByEmail.get(curr.email);

      if (!userId) {
        userId = crypto.randomUUID();
        plannedUsersByStNo.set(curr.studentNo, userId);
        plannedUsersByEmail.set(curr.email, userId);

        // Translate account type to user tag.
        // XXX: keep this in sync with types.ts. This should probably be put
        // somewhere else to avoid duplication.
        let accountTypeTag = UserTag.STUDENT;
        switch (curr.accountType) {
          case AccountType.STUDENT:
            accountTypeTag = UserTag.STUDENT;
            break;
          case AccountType.TRANSIENT:
            accountTypeTag = UserTag.GUEST;
            break;
          case AccountType.BOOTCAMP:
            accountTypeTag = UserTag.BOOTCAMP;
            break;
          case AccountType.ALUMNUS:
            accountTypeTag = UserTag.ALUMNUS;
            break;
          case AccountType.FACULTY:
            accountTypeTag = UserTag.FACULTY;
            break;
          case AccountType.STAFF:
            accountTypeTag = UserTag.STAFF;
            break;
          case AccountType.REPS:
            accountTypeTag = UserTag.REPS;
            break;
          default:
            throw new Error(`Unknown account type: ${curr.accountType} for ${residentName}`);
        }

        actions.push({
          type: "CREATE_USER",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          college: curr.college,
          program: curr.program,
          room: curr.room,
          bed: curr.bed,
          checkInDate: curr.checkInDate,
          accountType: curr.accountType || AccountType.STUDENT,
          currIndex: curr.rowIndex,
          details: `Create profile for ${curr.lastName.toUpperCase()}, ${curr.firstName.toUpperCase()}`,
          payload: {
            id: userId,
            email: curr.email,
            studentNo: curr.studentNo,
            college: curr.college,
            program: curr.program,
            firstName: curr.firstName.toUpperCase(),
            lastName: curr.lastName.toUpperCase(),
            tags: accountTypeTag,
            suffix: curr.suffix || "",
            overrideName: curr.overrideName || ""
          }
        });
      }

      if (isEmptyRoomBed) {
        actions.push({
          type: "EVALUATE_ONLY",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          college: curr.college,
          program: curr.program,
          room: curr.room,
          bed: curr.bed,
          checkInDate: curr.checkInDate,
          accountType: curr.accountType || AccountType.STUDENT,
          currIndex: curr.rowIndex,
          details: `Complete registration (No Room/Bed Assigned)`,
          to: "No Room/Bed Assigned",
          payload: null
        });
      } else {
        // Always create account for new user found in CURR
        actions.push({
          type: "CREATE_ACCOUNT",
          residentName,
          email: curr.email,
          studentNo: curr.studentNo,
          college: curr.college,
          program: curr.program,
          room: curr.room,
          bed: curr.bed,
          checkInDate: curr.checkInDate,
          accountType: curr.accountType || AccountType.STUDENT,
          currIndex: curr.rowIndex,
          details: `Assign to`,
          to: `${curr.room}-${curr.bed}`,
          warning,
          payload: {
            residentId: userId,
            period: currentTerm,
            room: curr.room,
            bed: curr.bed,
            checkInDate: curr.checkInDate,
            accountType: curr.accountType || AccountType.STUDENT
          }
        });
      }
    } else {
      // User exists, check for updates or bed assignments
      const colleges = (user.college || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const programs = (user.program || "")
        .split(":")
        .map((p) => p.trim())
        .filter(Boolean);

      const lastCollege = colleges[colleges.length - 1] || "";
      const lastProgram = programs[programs.length - 1] || "";

      const needsUpdate =
        curr.college !== lastCollege ||
        curr.program !== lastProgram ||
        (curr.suffix !== undefined && curr.suffix !== (user.suffix || "")) ||
        (curr.overrideName !== undefined && curr.overrideName !== (user.overrideName || ""));
      // A pre-existing users row may be a blank/placeholder profile (e.g. from
      // an earlier sync when the registration itself had no names). Fill in
      // missing names/student number so the profile isn't left blank.
      const needsNameFill =
        (curr.firstName && !user.firstName) || (curr.lastName && !user.lastName);
      const needsStudentNoFill = !!curr.studentNo && curr.studentNo !== (user.studentNo || "");
      if (needsUpdate || needsNameFill || needsStudentNoFill) {
        const newColleges = curr.college !== lastCollege ? [...colleges, curr.college] : colleges;
        const newPrograms = curr.program !== lastProgram ? [...programs, curr.program] : programs;

        actions.push({
          type: "UPDATE_USER",
          residentName,
          email: user.email,
          studentNo: curr.studentNo || user.studentNo,
          college: curr.college,
          program: curr.program,
          room: curr.room,
          bed: curr.bed,
          checkInDate: curr.checkInDate,
          accountType: curr.accountType || AccountType.STUDENT,
          currIndex: curr.rowIndex,
          details: needsNameFill
            ? `Fill in name on profile`
            : needsStudentNoFill
              ? `Fill in student number on profile`
              : `Update profile`,
          payload: {
            id: user.id,
            college: newColleges.join(","),
            program: newPrograms.join(":"),
            suffix: curr.suffix || "",
            overrideName: curr.overrideName || "",
            ...(needsNameFill && {
              firstName: curr.firstName.toUpperCase(),
              lastName: curr.lastName.toUpperCase()
            }),
            ...(needsStudentNoFill && { studentNo: curr.studentNo })
          }
        });
      }

      // Check account update
      const existingAcc = existingAccountMap.get(user.id);
      if (existingAcc) {
        if (!isEmptyRoomBed && (existingAcc.room !== curr.room || existingAcc.bed !== curr.bed)) {
          const oldLoc =
            existingAcc.room && existingAcc.bed
              ? `${existingAcc.room}-${existingAcc.bed}`
              : "Unassigned";

          actions.push({
            type: "UPDATE_ACCOUNT",
            residentName,
            email: user.email,
            studentNo: curr.studentNo || user.studentNo,
            college: curr.college,
            program: curr.program,
            room: curr.room,
            bed: curr.bed,
            checkInDate: curr.checkInDate,
            accountType: curr.accountType || AccountType.STUDENT,
            currIndex: curr.rowIndex,
            details: `Change bed`,
            from: oldLoc,
            to: `${curr.room}-${curr.bed}`,
            warning,
            payload: {
              accountId: existingAcc.id,
              room: curr.room,
              bed: curr.bed,
              checkInDate: curr.checkInDate
            }
          });
        }
      } else {
        if (isEmptyRoomBed) {
          const hasUserAction = actions.some((a) => a.currIndex === curr.rowIndex);
          if (!hasUserAction) {
            actions.push({
              type: "EVALUATE_ONLY",
              residentName,
              email: user.email,
              studentNo: curr.studentNo || user.studentNo,
              college: curr.college,
              program: curr.program,
              room: curr.room,
              bed: curr.bed,
              checkInDate: curr.checkInDate,
              accountType: curr.accountType || AccountType.STUDENT,
              currIndex: curr.rowIndex,
              details: `Complete registration (No Room/Bed Assigned)`,
              to: "No Room/Bed Assigned",
              payload: null
            });
          }
        } else {
          actions.push({
            type: "CREATE_ACCOUNT",
            residentName,
            email: user.email,
            studentNo: curr.studentNo || user.studentNo,
            college: curr.college,
            program: curr.program,
            room: curr.room,
            bed: curr.bed,
            checkInDate: curr.checkInDate,
            accountType: curr.accountType || AccountType.STUDENT,
            currIndex: curr.rowIndex,
            details: `New assignment`,
            to: `${curr.room}-${curr.bed}`,
            warning,
            payload: {
              residentId: user.id,
              period: currentTerm,
              room: curr.room,
              bed: curr.bed,
              checkInDate: curr.checkInDate,
              accountType: curr.accountType || AccountType.STUDENT
            }
          });
        }
      }
    }
  }

  return actions;
}

export async function applySync(actions: SyncPreviewAction[], term: string) {
  const userCreations = actions.filter((a) => a.type === "CREATE_USER");
  const userUpdates = actions.filter((a) => a.type === "UPDATE_USER");
  const accountUpdates = actions.filter((a) => a.type === "UPDATE_ACCOUNT");
  const accountCreations = actions.filter((a) => a.type === "CREATE_ACCOUNT");

  // 1. Create Users
  for (const action of userCreations) {
    await addUser(action.payload);
  }

  // 2. Update Users
  for (const action of userUpdates) {
    const { id, ...data } = action.payload;
    await updateUser(id, data);
  }

  // 3. Update Accounts
  if (accountUpdates.length > 0) {
    await roomsService.updateAccounts(
      accountUpdates.map((a) => ({
        id: a.payload.accountId,
        room: a.payload.room,
        bed: a.payload.bed,
        checkInDate: a.payload.checkInDate
      }))
    );
  }

  // 4. Create Accounts
  if (accountCreations.length > 0) {
    const rows: AccountRow[] = accountCreations.map((a) => ({
      id: crypto.randomUUID(),
      residentId: a.payload.residentId,
      period: a.payload.period,
      room: a.payload.room,
      bed: a.payload.bed,
      ceRefNo: "",
      ceIssued: "",
      ceLink: "",
      accountNotes: "",
      issuerId: "",
      checkInDate: a.payload.checkInDate,
      type: a.payload.accountType || AccountType.STUDENT
    }));
    await roomsService.appendAccounts(rows);
  }

  // 5. Mark CURR as Evaluated
  const evaluatedEntries = actions
    .filter((a) => a.currIndex !== undefined)
    .map((a) => ({
      email: (a.email || "").toLowerCase(),
      term,
      rowId: a.currIndex
    }))
    .filter((e, idx, arr) => arr.findIndex((x) => x.rowId === e.rowId) === idx);

  if (evaluatedEntries.length > 0) {
    await roomsService.markCurrEvaluated(evaluatedEntries);
  }

  return {
    usersCreated: userCreations.length,
    usersUpdated: userUpdates.length,
    accountsCreated: accountCreations.length,
    accountsUpdated: accountUpdates.length,
    evaluated: evaluatedEntries.length
  };
}

export async function declineRegistration(
  email: string,
  term: string,
  reason: string,
  rowId?: string | number
) {
  await roomsService.declineCurrRecord(email, term, reason, rowId);
}

export async function manualAssignBed(residentId: string, room: string, bed: string, term: string) {
  const accounts = await roomsService.fetchAccounts();
  const existing = accounts.find((a) => a.residentId === residentId && a.period === term);

  if (existing) {
    await roomsService.updateAccountRoomBed(residentId, term, room, bed);
  } else {
    await roomsService.addAccount({
      id: crypto.randomUUID(),
      residentId,
      period: term,
      room,
      bed,
      ceRefNo: "",
      ceIssued: "",
      ceLink: "",
      accountNotes: "",
      issuerId: "",
      checkInDate: "",
      type: AccountType.STUDENT
    });
  }
}

export async function manualDelistResident(
  residentId: string,
  term: string,
  reason: "remove" | "early_checkout" | "transferred" | "deceased" | "loa",
  waiveBalance = false
) {
  const accounts = await roomsService.fetchAccounts();
  const account = accounts.find((a) => a.residentId === residentId && a.period === term);

  if (!account) {
    throw new Error("Active account entry for resident not found in this term.");
  }

  if (reason === "remove") {
    await roomsService.deleteAccountRow(residentId, term);
  } else {
    const currentBed = (account.bed || "").trim();

    let reasonText = "";
    if (reason === "early_checkout") {
      reasonText = "Early checkout";
    } else if (reason === "transferred") {
      reasonText = "Transferred to another residence hall";
    } else if (reason === "deceased") {
      reasonText = "Deceased";
      await updateUser(residentId, { tags: UserTag.DECEASED });
    } else if (reason === "loa") {
      reasonText = "Leave of Absence";
    }

    const updatedBed = `${currentBed} (${reasonText})`;
    await roomsService.updateAccountBed(residentId, term, updatedBed);

    if (
      (reason === "early_checkout" ||
        reason === "loa" ||
        reason === "deceased" ||
        reason === "transferred") &&
      waiveBalance
    ) {
      const residents = await fetchResidents(true);
      const resRecord = residents.find((r) => {
        return r.residentId === residentId && r.period === term;
      });
      if (resRecord && resRecord.bal > 0) {
        const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;

        let remainingToWaive = resRecord.bal;
        let waterWaiveAmt = 0;
        let assocWaiveAmt = 0;
        let maintenanceWaiveAmt = 0;
        let miscWaiveAmt = 0;

        if (resRecord.waterBal > 0) {
          waterWaiveAmt = Math.min(resRecord.waterBal, remainingToWaive);
          remainingToWaive -= waterWaiveAmt;
        }
        if (remainingToWaive > 0 && resRecord.assocBal > 0) {
          assocWaiveAmt = Math.min(resRecord.assocBal, remainingToWaive);
          remainingToWaive -= assocWaiveAmt;
        }
        if (remainingToWaive > 0 && (resRecord.maintenanceBal || 0) > 0) {
          maintenanceWaiveAmt = Math.min(resRecord.maintenanceBal || 0, remainingToWaive);
          remainingToWaive -= maintenanceWaiveAmt;
        }
        if (remainingToWaive > 0) {
          miscWaiveAmt = remainingToWaive;
        }

        const dateStr = new Date()
          .toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric"
          })
          .toUpperCase();
        let noteLabel = "";
        if (reason === "early_checkout") {
          noteLabel = `EARLY CHECKOUT (${dateStr})`;
        } else if (reason === "loa") {
          noteLabel = `LEAVE OF ABSENCE (${dateStr})`;
        } else if (reason === "deceased") {
          noteLabel = `DECEASED (${dateStr})`;
        } else if (reason === "transferred") {
          noteLabel = `TRANSFERRED TO ANOTHER RESIDENCE HALL (${dateStr})`;
        }

        // FIXME: this looks broken since it's still using the legacy email as ID behavior.
        await addJournalEntries([
          {
            date: getLocalDateString(),
            creator: auth.user?.email || "",
            account: resRecord.email,
            water: waterWaiveAmt,
            assoc: assocWaiveAmt,
            maintenance: maintenanceWaiveAmt,
            misc: miscWaiveAmt,
            mop: "",
            period: term,
            type: pmtWaived,
            notes: noteLabel,
            notesPrivate: "",
            mopRefNo: "",
            prDateIssued: "",
            prRefNo: "",
            creatorName: auth.displayNameLastFirst,
            name: resRecord.name,
            stno: resRecord.stno,
            wasAudited: false,
            receiptUrl: "",
            id: crypto.randomUUID()
          }
        ]);
      }
    }
  }
}
