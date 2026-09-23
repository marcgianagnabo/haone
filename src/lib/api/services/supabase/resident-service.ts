import type { ResidentRecord, UserRecord } from "$lib/types";
import { AccountType, TRANSACTION_TYPE_CONFIG, TransactionType } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { parseCSVAmount } from "$utils/math";
import { parseDateWeight, parseDbDate, parseDbUuid } from "$utils/parsers";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  supabase
} from "../common";
import type { ResidentServiceInterface } from "../interfaces/resident-service.interface";
import { supabaseConstantsService } from "./constants-service";

function mapDbUserToUserRecord(u: any): UserRecord {
  if (!u) {
    return {} as UserRecord;
  }
  return {
    id: u.id,
    email: u.email,
    lastName: u.last_name || "",
    firstName: u.first_name || "",
    middleName: u.middle_name || "",
    suffix: u.suffix || "",
    overrideName: u.override_name || "",
    displayName: u.display_name || "",
    displayNameFormal: u.display_name_fl || "",
    studentNo: u.student_no || "",
    secondaryContact: u.secondary_contact || "",
    address: u.address || "",
    college: u.college || "",
    program: u.degree_program || "",
    // Sheets stores tags ":"-delimited; keep that convention for consumers.
    tags: Array.isArray(u.tags) ? u.tags.join(":") : u.tags || "",
    notes: u.notes || "",
    raw: u
  };
}

function mapUserRecordToDb(data: Partial<UserRecord>): Record<string, any> {
  const payload: Record<string, any> = {};
  if (data.email !== undefined) {
    payload.email = data.email.trim().toLowerCase();
  }
  if (data.lastName !== undefined) {
    payload.last_name = data.lastName.trim().toUpperCase();
  }
  if (data.firstName !== undefined) {
    payload.first_name = data.firstName.trim().toUpperCase();
  }
  if (data.middleName !== undefined) {
    payload.middle_name = data.middleName.trim().toUpperCase();
  }
  if (data.suffix !== undefined) {
    payload.suffix = data.suffix.trim().toUpperCase();
  }
  if (data.overrideName !== undefined) {
    payload.override_name = data.overrideName.trim();
  }
  if (data.studentNo !== undefined) {
    payload.student_no = data.studentNo;
  }
  if (data.secondaryContact !== undefined) {
    payload.secondary_contact = data.secondaryContact;
  }
  if (data.address !== undefined) {
    payload.address = data.address;
  }
  if (data.college !== undefined) {
    payload.college = data.college;
  }
  if (data.program !== undefined) {
    payload.degree_program = data.program;
  }
  if (data.tags !== undefined) {
    payload.tags = data.tags
      ? data.tags
          .split(/[,:]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }
  if (data.notes !== undefined) {
    payload.notes = data.notes;
  }
  return payload;
}

export const supabaseResidentService: ResidentServiceInterface = {
  async fetchResidents(_bypassCache = false, term?: string): Promise<ResidentRecord[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;

    const [accData, usersData, journalList, consts] = await Promise.all([
      fetchAllSupabaseRows(() => {
        let query = sb.from("accounts").select("*");
        if (term && !auth.isResident) {
          query = query.eq("period", term);
        }
        return query.order("created_at", { ascending: true }).order("id", { ascending: true });
      }),
      fetchAllSupabaseRows(() =>
        sb.from("users_view").select("*").order("id", { ascending: true })
      ),
      fetchAllSupabaseRows(() =>
        sb
          .from("journal")
          .select("*")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      supabaseConstantsService.fetchConstants()
    ]);

    let currentUserId: string | null = null;
    if (auth.isResident && auth.user) {
      currentUserId = auth.userId;
    }

    const targetAccounts = currentUserId
      ? accData.filter((a: any) => a.resident_id === currentUserId)
      : accData;

    const userMap = new Map<string, any>();
    usersData.forEach((u: any) => {
      userMap.set(u.id, u);
    });

    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "0";
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;
    const isWaivedEntry = (t: string) =>
      t === pmtWaived || (t && t.toUpperCase().includes("WAIVED"));

    const result = targetAccounts
      .map((row: any) => {
        const u = userMap.get(row.resident_id) || {};
        const period = row.period || "";
        const email = (u.email || "").toLowerCase().trim();
        const stno = (u.student_no || "").toLowerCase().trim();
        const resId = (row.resident_id || "").toLowerCase();

        const filtered = journalList.filter((j: any) => {
          if (j.period !== period) {
            return false;
          }
          const accId = (j.account_id || "").toLowerCase().trim();
          return (resId && accId === resId) || (u.id && accId === u.id.toLowerCase());
        });

        const waterPaid = filtered
          .filter((j: any) => !isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);
        const waterWaived = filtered
          .filter((j: any) => isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);

        const assocPaid = filtered
          .filter((j: any) => !isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);
        const assocWaived = filtered
          .filter((j: any) => isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);

        const maintenancePaid = filtered
          .filter((j: any) => !isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.maintenance), 0);
        const maintenanceWaived = filtered
          .filter((j: any) => isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.maintenance), 0);

        const waterBase = parseCSVAmount(getConst(`FEES_${period}_WATER`));
        const assocBase = parseCSVAmount(getConst(`FEES_${period}_ASSOC`));
        const maintenanceBase = parseCSVAmount(getConst(`FEES_${period}_MAINTENANCE`));

        const waterBal = waterBase - waterPaid - waterWaived;
        const assocBal = assocBase - assocPaid - assocWaived;
        const maintenanceBal = maintenanceBase - maintenancePaid - maintenanceWaived;
        const totalBase = waterBase + assocBase + maintenanceBase;
        const paid = waterPaid + assocPaid + maintenancePaid;
        const waived = waterWaived + assocWaived + maintenanceWaived;
        const bal = totalBase - paid - waived;

        return {
          id: row.id,
          residentId: row.resident_id || "",
          period: period,
          room: row.room || "",
          bed: row.bed || "",
          ceRefNo: row.ce_ref_no || "",
          ceIssued: row.ce_issued || "",
          ceLink: row.ce_link || "",
          notes: row.account_notes || "",
          issuerId: row.issuer_id || "",
          checkInDate: row.check_in_date || "",
          type: row.type || "",
          email: u.email || "",
          name: u.display_name || "",
          stno: u.student_no || "",
          waterBase,
          waterPaid,
          waterWaived,
          waterBal,
          assocBase,
          assocPaid,
          assocWaived,
          assocBal,
          maintenanceBase,
          maintenancePaid,
          maintenanceWaived,
          maintenanceBal,
          totalBase,
          paid,
          waived,
          bal,
          isFullyPaid: bal <= 0,
          college: u.college || "",
          program: u.degree_program || "",
          ceFullName: u.display_name_fl || "",
          ledgerId: row.id,
          raw: row
        };
      })
      .filter((r: any) => r.residentId && r.residentId !== "") as ResidentRecord[];

    if (auth.isResident) {
      result.sort((a, b) => b.period.localeCompare(a.period));
    }

    return result;
  },

  async fetchResidentStatus(term?: string, _bypassCache = false): Promise<any> {
    if (!supabase) {
      return null;
    }

    // Sheets always derives the identity from the auth token; mirror that.
    const email = (auth.user?.email || "").toLowerCase().trim();
    const sb = supabase;

    const { data: userRow, error: userErr } = await supabase
      .from("users_view")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (userErr) {
      handleSupabaseError(userErr);
    }

    const consts = await supabaseConstantsService.fetchConstants();
    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "";
    const activeTerm = getConst("TERM_CURR");
    const targetTerm = term || activeTerm;

    const [accRes, journalList, currRes, termAccRes] = await Promise.all([
      userRow
        ? supabase.from("accounts").select("*").eq("resident_id", userRow.id)
        : Promise.resolve({ data: [], error: null }),
      userRow?.id
        ? fetchAllSupabaseRows(() =>
            sb
              .from("journal")
              .select("*")
              .eq("account_id", userRow.id)
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
          )
        : Promise.resolve([]),
      supabase
        .from("registrations")
        .select("*")
        .ilike("email", email)
        .eq("term", activeTerm)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("accounts").select("resident_id, room, bed, period").eq("period", targetTerm)
    ]);
    if (accRes.error) {
      handleSupabaseError(accRes.error);
    }
    if (currRes.error) {
      handleSupabaseError(currRes.error);
    }
    if (termAccRes.error) {
      handleSupabaseError(termAccRes.error);
    }

    const currentUser = userRow || null;
    const userAccounts: any[] = accRes.data || [];
    const currEntryData = currRes.data;

    // ── Transactions (all terms unless an explicit term was requested) ──
    const transactions = journalList
      .filter((j: any) => !term || j.period === term)
      .map((j: any) => ({
        id: j.id,
        date: j.date,
        type: j.type || "",
        amount:
          parseCSVAmount(j.water) +
          parseCSVAmount(j.assoc) +
          parseCSVAmount(j.misc) +
          parseCSVAmount(j.maintenance),
        period: j.period || "",
        mop: j.mop || "",
        notes: j.notes || "",
        creator: j.creator_id || j.creator_email || "",
        prRefNo: j.pr_ref_no || "",
        runningBalance: 0
      }));

    let globalBalance = 0;
    const sortedTransactions = [...transactions].sort(
      (a, b) => parseDateWeight(a.date) - parseDateWeight(b.date)
    );
    for (const t of sortedTransactions) {
      if (!t.type.toUpperCase().includes("WAIVED")) {
        globalBalance += t.amount;
      }
      t.runningBalance = globalBalance;
    }

    // ── Financials for the target term ──
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;
    const termJournals = journalList.filter((j: any) => j.period === targetTerm);

    const waterPaid = termJournals
      .filter((j: any) => j.type !== pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);
    const waterWaived = termJournals
      .filter((j: any) => j.type === pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);
    const assocPaid = termJournals
      .filter((j: any) => j.type !== pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);
    const assocWaived = termJournals
      .filter((j: any) => j.type === pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);

    const maintenancePaid = termJournals
      .filter((j: any) => j.type !== pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.maintenance), 0);
    const maintenanceWaived = termJournals
      .filter((j: any) => j.type === pmtWaived)
      .reduce((sum: number, j: any) => sum + parseCSVAmount(j.maintenance), 0);

    const waterBase = parseCSVAmount(getConst(`FEES_${targetTerm}_WATER`));
    const assocBase = parseCSVAmount(getConst(`FEES_${targetTerm}_ASSOC`));
    const maintenanceBase = parseCSVAmount(getConst(`FEES_${targetTerm}_MAINTENANCE`));
    const totalBase = waterBase + assocBase + maintenanceBase;
    const paid = waterPaid + assocPaid + maintenancePaid;
    const waived = waterWaived + assocWaived + maintenanceWaived;
    const bal = totalBase - paid - waived;

    const targetAccount = userAccounts.find((a: any) => a.period === targetTerm) || null;

    const allTerms = [...new Set(journalList.map((j: any) => j.period).filter(Boolean))];
    if (activeTerm && !allTerms.includes(activeTerm)) {
      allTerms.push(activeTerm);
    }

    const mopTypes = consts
      .filter((c) => c.key.startsWith("MOP_"))
      .map((c) => ({ value: c.value || c.key, label: c.description || c.value || c.key }));

    const isEvaluated = currEntryData?.evaluated ?? false;

    const college = currentUser ? (currentUser.college || "").split(",").pop()?.trim() || "" : "";
    const program = currentUser
      ? (currentUser.degree_program || "").split(":").pop()?.trim() || ""
      : "";

    return {
      isRegistered: !!currentUser,
      hasActiveAccount: !!targetAccount,
      waitingForConfirmation: !!(currEntryData && !isEvaluated),
      activeTerm: targetTerm,
      systemActiveTerm: activeTerm,
      allTerms: allTerms.sort().reverse(),
      mopTypes,
      profile: currentUser
        ? {
            id: currentUser.id,
            email: currentUser.email,
            firstName: currentUser.first_name || "",
            lastName: currentUser.last_name || "",
            studentNo: currentUser.student_no || "",
            college,
            program,
            tags: Array.isArray(currentUser.tags)
              ? currentUser.tags.join(",")
              : currentUser.tags || "",
            suffix: currentUser.suffix || "",
            overrideName: currentUser.override_name || ""
          }
        : null,
      account: targetAccount
        ? {
            residentId: currentUser?.id || "",
            email: currentUser?.email || "",
            period: targetAccount.period || "",
            room: targetAccount.room || "",
            bed: targetAccount.bed || "",
            checkInDate: targetAccount.check_in_date || "",
            name: currentUser?.display_name || "",
            stno: currentUser?.student_no || "",
            waterBase,
            waterPaid,
            waterWaived,
            waterBal: waterBase - waterPaid - waterWaived,
            assocBase,
            assocPaid,
            assocWaived,
            assocBal: assocBase - assocPaid - assocWaived,
            maintenanceBase,
            maintenancePaid,
            maintenanceWaived,
            maintenanceBal: maintenanceBase - maintenancePaid - maintenanceWaived,
            totalBase,
            paid,
            waived,
            bal,
            isFullyPaid: bal <= 0,
            ceRefNo: targetAccount.ce_ref_no || "",
            ceIssued: targetAccount.ce_issued || "",
            ceLink: targetAccount.ce_link || "",
            college,
            program,
            type: (targetAccount.type || "").trim().toUpperCase()
          }
        : null,
      currEntry: currEntryData
        ? {
            room: currEntryData.room || "",
            bed: currEntryData.bed || "",
            lastName: currEntryData.last_name || "",
            firstName: currEntryData.first_name || "",
            college: currEntryData.college || "",
            program: currEntryData.program || "",
            studentNo: currEntryData.student_no || "",
            accountType: (currEntryData.account_type || "").trim().toUpperCase(),
            suffix: currEntryData.suffix || "",
            overrideName: currEntryData.override_name || "",
            declineReason: (
              currEntryData.decline_reason ||
              currEntryData.declination_reason ||
              ""
            ).trim(),
            isEvaluated
          }
        : null,
      transactions: sortedTransactions.reverse(),
      // NOTE: under RLS, residents only see their own account rows, so this
      // list is only complete for officers.
      occupiedBeds: (termAccRes.data || [])
        .filter((a: any) => a.room && a.bed && (!currentUser || a.resident_id !== currentUser.id))
        .map((a: any) => ({ room: (a.room || "").trim(), bed: (a.bed || "").trim() }))
    };
  },

  async changeAccountType(residentId: string, period: string, newType: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update({ type: newType })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Account row not found in spreadsheet.");
  },

  async fetchUsers(_bypassCache = false): Promise<UserRecord[]> {
    if (!supabase) {
      return [];
    }
    if (auth.isResident) {
      return [];
    }
    const sb = supabase;
    const data = await fetchAllSupabaseRows(() =>
      sb.from("users_view").select("*").order("id", { ascending: true })
    );
    return data.map(mapDbUserToUserRecord);
  },

  async updateUser(userId: string, data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    const { data: updated, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "User not found");
  },

  async addUser(data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    payload.id = data.id || crypto.randomUUID();
    const { error } = await supabase.from("users").insert(payload);
    if (error) {
      handleSupabaseError(error);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("users").delete().eq("id", userId).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "User not found in spreadsheet");
  },

  async updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void> {
    if (!supabase) {
      return;
    }

    const { data: updated, error } = await supabase
      .from("accounts")
      .update({
        ce_ref_no: data.refNo,
        ce_issued: parseDbDate(data.dateString),
        ce_link: data.publicLink,
        issuer_id: parseDbUuid(data.issuerId)
      })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Resident not found in sheet");
  },

  async registerResident(data: Record<string, any>): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client uninitialized");
    }

    const targetEmail = (data.email || "").toLowerCase();
    if (!targetEmail) {
      throw new Error("Missing email");
    }

    const resolvedAccountType = data.accountType || AccountType.STUDENT;

    if (!targetEmail.endsWith("@up.edu.ph") && resolvedAccountType === AccountType.STUDENT) {
      throw new Error("Only @up.edu.ph email addresses are allowed for student accounts.");
    }

    const { data: constData, error: constErr } = await supabase
      .from("constants")
      .select("value")
      .eq("key", "TERM_CURR")
      .maybeSingle();
    if (constErr) {
      handleSupabaseError(constErr);
    }
    const activeTerm = constData?.value || "";

    const { data: userRows, error: userErr } = await supabase
      .from("users_view")
      .select("id")
      .ilike("email", targetEmail);
    if (userErr) {
      handleSupabaseError(userErr);
    }

    const isAlreadyRegistered = (userRows || []).length > 0;

    let finalStudentNo = data.studentNo;
    if (resolvedAccountType !== AccountType.STUDENT && !data.studentNo) {
      const randomUuid = crypto.randomUUID();
      finalStudentNo = `${resolvedAccountType}-${activeTerm}-${randomUuid}`;
    }

    const evaluated = resolvedAccountType === AccountType.ALUMNUS && isAlreadyRegistered;

    const { error: currErr } = await supabase.from("registrations").insert({
      email: targetEmail,
      room: data.room || "",
      bed: data.bed || "",
      last_name: (data.lastName || "").trim().toUpperCase(),
      first_name: (data.firstName || "").trim().toUpperCase(),
      college: data.college || "",
      program: data.program || "",
      student_no: finalStudentNo || "",
      check_in_date: parseDbDate(data.checkInDate),
      evaluated: evaluated,
      term: activeTerm,
      account_type: resolvedAccountType,
      suffix: (data.suffix || "").trim().toUpperCase(),
      override_name: (data.overrideName || "").trim().toUpperCase()
    });

    if (currErr) {
      handleSupabaseError(currErr);
    }
  }
};
