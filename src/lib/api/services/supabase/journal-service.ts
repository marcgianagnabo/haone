import type { JournalRecord, PaginatedResponse, PaginationOptions } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { parseCSVAmount } from "$utils/math";
import { getLocalDateString, isUuid, parseDbDate } from "$utils/parsers";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  resolveSupabaseUserId,
  supabase
} from "../common";
import type {
  JournalFilters,
  JournalServiceInterface
} from "../interfaces/journal-service.interface";

function applyFilters(query: any, filters?: JournalFilters) {
  if (filters?.term) {
    query = query.eq("period", filters.term);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.mop) {
    query = query.eq("mop", filters.mop);
  }
  if (filters?.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},creator_id.eq.${filters.accountId}`);
  }
  return query;
}

export const supabaseJournalService: JournalServiceInterface = {
  async fetchJournalEntries(
    filters?: JournalFilters,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;

    const isPaginated = !!(options?.page && options?.pageSize);

    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = applyFilters(supabase.from("journal").select("*", { count: "exact" }), filters)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize!;
      const { data: rows, count: total, error } = await query.range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = rows || [];
      count = total || 0;
    } else {
      data = await fetchAllSupabaseRows(() =>
        applyFilters(sb.from("journal").select("*"), filters)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      );
    }

    const usersRes = await supabase
      .from("users_view")
      .select("id, email, display_name, student_no");
    if (usersRes.error) {
      handleSupabaseError(usersRes.error);
    }

    const userMap = new Map<string, any>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id.toLowerCase().trim(), u);
      }
      if (u.email) {
        userMap.set(u.email.toLowerCase().trim(), u);
      }
    });

    const items: JournalRecord[] = data.map((row: any) => {
      const accountId = (row.account_id || "").toLowerCase().trim();
      const creatorId = (row.creator_id || "").toLowerCase().trim();
      const accountUser = userMap.get(accountId);
      const creatorUser = userMap.get(creatorId);

      return {
        id: row.id,
        date: row.date,
        creator: creatorUser?.email || "",
        account: accountUser?.email || "",
        water: parseCSVAmount(row.water),
        assoc: parseCSVAmount(row.assoc),
        misc: parseCSVAmount(row.misc),
        amount:
          parseCSVAmount(row.water) +
          parseCSVAmount(row.assoc) +
          parseCSVAmount(row.misc) +
          parseCSVAmount(row.maintenance),
        mop: row.mop || "",
        period: row.period || "",
        type: row.type || "",
        notes: row.notes || "",
        notesPrivate: row.notes_private || "",
        mopRefNo: row.mop_ref_no || "",
        prDateIssued: row.pr_date_issued || "",
        prRefNo: row.pr_ref_no || "",
        creatorName: creatorUser?.display_name || "",
        name: accountUser?.display_name || "",
        stno: accountUser?.student_no || "",
        wasAudited: row.was_audited || false,
        receiptUrl: row.receipt_url || "",
        creatorId: row.creator_id || undefined,
        accountId: row.account_id || undefined,
        maintenance: parseCSVAmount(row.maintenance),
        raw: row
      };
    });

    // Residents must not see private notes or receipt URLs (Sheets strips them).
    if (auth.isResident) {
      for (const item of items) {
        item.notesPrivate = "";
        item.receiptUrl = "";
      }
    }

    if (isPaginated) {
      return {
        items,
        totalCount: count,
        page: options!.page!,
        pageSize: options!.pageSize!,
        totalPages: Math.ceil(count / options!.pageSize!)
      };
    }

    return items;
  },

  async addJournalEntry(data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    const creatorId = await resolveSupabaseUserId(data.creatorId || data.creator, auth.user?.email);
    const accountId = await resolveSupabaseUserId(data.accountId || data.account);

    const { error } = await supabase.from("journal").insert({
      id: data.id || crypto.randomUUID(),
      date: parseDbDate(data.date) || getLocalDateString(),
      creator_id: creatorId,
      account_id: accountId,
      water: data.water ?? 0,
      assoc: data.assoc ?? 0,
      misc: data.misc ?? 0,
      maintenance: data.maintenance ?? 0,
      mop: data.mop,
      period: data.period,
      type: data.type,
      notes: data.notes,
      notes_private: data.notesPrivate,
      mop_ref_no: data.mopRefNo,
      pr_date_issued: parseDbDate(data.prDateIssued),
      pr_ref_no: data.prRefNo,
      was_audited: data.wasAudited ?? false,
      receipt_url: data.receiptUrl
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    const payload: Record<string, any> = {};
    if (data.date !== undefined) {
      payload.date = parseDbDate(data.date);
    }
    if (data.creatorId !== undefined || data.creator !== undefined) {
      let cId = data.creatorId;
      if (!cId && data.creator) {
        if (isUuid(data.creator)) {
          cId = data.creator;
        } else {
          const { data: u } = await supabase
            .from("users_view")
            .select("id")
            .ilike("email", data.creator.trim())
            .maybeSingle();
          if (u?.id) {
            cId = u.id;
          }
        }
      }
      payload.creator_id = cId && isUuid(cId) ? cId : null;
    }
    if (data.accountId !== undefined || data.account !== undefined) {
      let aId = data.accountId;
      if (!aId && data.account) {
        if (isUuid(data.account)) {
          aId = data.account;
        } else {
          const { data: u } = await supabase
            .from("users_view")
            .select("id")
            .or(`email.ilike.${data.account.trim()},student_no.ilike.${data.account.trim()}`)
            .maybeSingle();
          if (u?.id) {
            aId = u.id;
          }
        }
      }
      payload.account_id = aId && isUuid(aId) ? aId : null;
    }
    if (data.water !== undefined) {
      payload.water = data.water;
    }
    if (data.assoc !== undefined) {
      payload.assoc = data.assoc;
    }
    if (data.misc !== undefined) {
      payload.misc = data.misc;
    }
    if (data.maintenance !== undefined) {
      payload.maintenance = data.maintenance;
    }
    if (data.mop !== undefined) {
      payload.mop = data.mop;
    }
    if (data.period !== undefined) {
      payload.period = data.period;
    }
    if (data.type !== undefined) {
      payload.type = data.type;
    }
    if (data.notes !== undefined) {
      payload.notes = data.notes;
    }
    if (data.notesPrivate !== undefined) {
      payload.notes_private = data.notesPrivate;
    }
    if (data.mopRefNo !== undefined) {
      payload.mop_ref_no = data.mopRefNo;
    }
    if (data.prDateIssued !== undefined) {
      payload.pr_date_issued = parseDbDate(data.prDateIssued);
    }
    if (data.prRefNo !== undefined) {
      payload.pr_ref_no = data.prRefNo;
    }
    if (data.wasAudited !== undefined) {
      payload.was_audited = data.wasAudited;
    }
    if (data.receiptUrl !== undefined) {
      payload.receipt_url = data.receiptUrl;
    }

    const { data: updated, error } = await supabase
      .from("journal")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Journal entry not found");
  },

  async deleteJournalEntry(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("journal").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Journal entry not found");
  },

  async batchAuditEntries(ids: string[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const validIds = ids.filter((id) => isUuid(id));
    if (validIds.length === 0) {
      return;
    }
    const { error } = await supabase
      .from("journal")
      .update({ was_audited: true })
      .in("id", validIds);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
