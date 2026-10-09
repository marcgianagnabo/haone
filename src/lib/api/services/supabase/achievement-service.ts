import type {
  AchievementLogRecord,
  AchievementRecord,
  PaginatedResponse,
  PaginationOptions
} from "$lib/types";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  supabase
} from "../common";
import type { AchievementServiceInterface } from "../interfaces/achievement-service.interface";

import { isUuid } from "$utils/parsers";

function emptyLogs(
  options?: PaginationOptions
): AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord> {
  if (options?.page && options?.pageSize) {
    return {
      items: [],
      totalCount: 0,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: 0
    };
  }
  return [];
}

/**
 * RLS-safe per-term eligible headcounts (see migration
 * 20260926000000_achievements_feature_flag.sql). Term "" holds the total user
 * count used for all-time (no term) achievements. Missing rows fall back to 0.
 */
async function fetchEligibleCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!supabase) {
    return counts;
  }
  const { data, error } = await supabase.rpc("get_achievement_eligible_counts");
  if (error) {
    // The RPC is created by a migration; tolerate it being absent so the page
    // still renders (percentages simply fall back to 0).
    console.error("[Achievements] get_achievement_eligible_counts failed:", error.message);
    return counts;
  }
  for (const row of data || []) {
    counts.set((row.term || "").trim(), Number(row.eligible_count) || 0);
  }
  return counts;
}

/**
 * RLS-safe id -> display name map (see migration 20260927000000). Tolerates
 * the RPC being absent so the page still renders with fallback names.
 */
async function fetchEarnerNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!supabase) {
    return names;
  }
  const { data, error } = await supabase.rpc("get_achievement_earner_names");
  if (error) {
    console.error("[Achievements] get_achievement_earner_names failed:", error.message);
    return names;
  }
  for (const row of data || []) {
    if (row.account_id) {
      names.set(String(row.account_id).trim(), (row.display_name || "").trim() || "Resident");
    }
  }
  return names;
}

export const supabaseAchievementService: AchievementServiceInterface = {
  async fetchAchievements(
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<AchievementRecord[] | PaginatedResponse<AchievementRecord>> {
    if (!supabase) {
      return [];
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      const {
        data: d,
        error,
        count: c
      } = await supabase.from("achievements").select("*", { count: "exact" }).range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = d || [];
      count = c || 0;
    } else {
      const { data: d, error } = await supabase.from("achievements").select("*");
      if (error) {
        handleSupabaseError(error);
      }
      data = d || [];
    }

    const eligibleCounts = await fetchEligibleCounts();

    const items = data.map((row: any) => ({
      id: row.id,
      creatorId: row.creator_id || "",
      name: row.name || "",
      description: row.description || "",
      icon: row.icon || "",
      extraUrl: row.extra_url || "",
      term: row.term || "",
      points: row.points || 0,
      totalEligibleCount: eligibleCounts.get((row.term || "").trim()) ?? 0,
      raw: row
    }));

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

  async fetchAchievementLogs(
    residentId?: string,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<AchievementLogRecord[] | PaginatedResponse<AchievementLogRecord>> {
    if (!supabase) {
      return [];
    }

    if (residentId && !isUuid(residentId)) {
      // A non-UUID id can never match; Sheets' equality filter yields nothing.
      return emptyLogs(options);
    }

    const isPaginated = !!(options?.page && options?.pageSize);
    let data: any[] = [];
    let count = 0;

    if (isPaginated) {
      let query = supabase.from("achievement_records").select("*", { count: "exact" });
      if (residentId) {
        query = query.eq("account_id", residentId);
      }
      query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize! - 1;
      const { data: rows, count: total, error } = await query.range(start, end);
      if (error) {
        handleSupabaseError(error);
      }
      data = rows || [];
      count = total || 0;
    } else {
      const sb = supabase;
      data = await fetchAllSupabaseRows(() => {
        let query = sb.from("achievement_records").select("*");
        if (residentId) {
          query = query.eq("account_id", residentId);
        }
        return query.order("date", { ascending: true }).order("id", { ascending: true });
      });
    }

    // Privacy toggle is removed: earner names are always shown. Names come
    // from the RLS-safe get_achievement_earner_names() RPC (see migration
    // 20260927000000); a missing RPC still renders with a fallback name.
    const earnerNames = await fetchEarnerNames();

    const items: AchievementLogRecord[] = data.map((row: any) => ({
      id: row.id,
      recorderId: row.recorder_id,
      accountId: row.account_id,
      date: row.date,
      achievementId: row.achievement_id,
      term: row.term,
      displayName: earnerNames.get((row.account_id || "").trim()) || "Resident",
      isPublic: true,
      raw: row
    }));

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

  async addAchievement(data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievements").insert({
      id: data.id || crypto.randomUUID(),
      creator_id: data.creatorId,
      name: data.name,
      description: data.description,
      icon: data.icon,
      extra_url: data.extraUrl,
      term: data.term,
      points: data.points ?? 0
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateAchievement(id: string, data: Partial<AchievementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.creatorId !== undefined) {
      payload.creator_id = data.creatorId;
    }
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    if (data.description !== undefined) {
      payload.description = data.description;
    }
    if (data.icon !== undefined) {
      payload.icon = data.icon;
    }
    if (data.extraUrl !== undefined) {
      payload.extra_url = data.extraUrl;
    }
    if (data.term !== undefined) {
      payload.term = data.term;
    }
    if (data.points !== undefined) {
      payload.points = data.points;
    }

    const { data: updated, error } = await supabase
      .from("achievements")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Achievement not found");
  },

  async deleteAchievement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("achievements").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Achievement not found");
  },

  async awardAchievement(data: Partial<AchievementLogRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("achievement_records").insert({
      id: data.id || crypto.randomUUID(),
      recorder_id: data.recorderId,
      account_id: data.accountId,
      date: data.date,
      achievement_id: data.achievementId,
      term: data.term
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async revokeAchievement(logId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("achievement_records")
      .delete()
      .eq("id", logId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Achievement log not found");
  },

  async awardAchievementBatch(records: Partial<AchievementLogRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const toInsert = records.map((r) => ({
      id: r.id || crypto.randomUUID(),
      recorder_id: r.recorderId,
      account_id: r.accountId,
      date: r.date,
      achievement_id: r.achievementId,
      term: r.term
    }));

    const { error } = await supabase.from("achievement_records").insert(toInsert);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
