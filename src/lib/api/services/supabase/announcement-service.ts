import type { AnnouncementRecord, PaginatedResponse, PaginationOptions } from "$lib/types";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  supabase
} from "../common";
import type { AnnouncementServiceInterface } from "../interfaces/announcement-service.interface";

function toDbDate(value?: string | null | undefined): string | null {
  return value ? value : null;
}

function mapRow(row: any): AnnouncementRecord {
  return {
    id: row.id,
    creatorId: row.creator_id,
    dateCreated: row.created_at,
    startDate: row.start_date,
    expiryDate: row.expiry_date,
    isIndefinite: row.is_indefinite ?? false,
    isAdminOnly: row.is_admin_only ?? false,
    isUnlisted: row.is_unlisted ?? false,
    tags: row.tags ? row.tags.join(",") : "",
    title: row.title,
    content: row.content,
    slug: row.slug,
    broadcastCount: row.broadcast_count ?? 0,
    raw: row
  };
}

function applyActiveFilters(query: any) {
  const now = new Date().toISOString();
  return query
    .or("is_admin_only.is.null,is_admin_only.eq.false")
    .or("is_unlisted.is.null,is_unlisted.eq.false")
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`is_indefinite.eq.true,expiry_date.is.null,expiry_date.gte.${now}`);
}

export const supabaseAnnouncementService: AnnouncementServiceInterface = {
  async fetchAnnouncements(
    options?: PaginationOptions,
    activeOnly = false,
    _bypassCache?: boolean
  ): Promise<AnnouncementRecord[] | PaginatedResponse<AnnouncementRecord>> {
    if (!supabase) {
      return [];
    }

    const isPaginated = !!(options?.page && options?.pageSize);

    if (!isPaginated) {
      const sb = supabase;
      const data = await fetchAllSupabaseRows(() => {
        let query = sb.from("announcements").select("*");
        if (activeOnly) {
          query = applyActiveFilters(query);
        }
        return query.order("created_at", { ascending: false }).order("id", { ascending: true });
      });
      return data.map(mapRow);
    }

    let query = supabase.from("announcements").select("*", { count: "exact" });
    if (activeOnly) {
      query = applyActiveFilters(query);
    }
    query = query.order("created_at", { ascending: false }).order("id", { ascending: true });

    const start = (options!.page! - 1) * options!.pageSize!;
    const end = start + options!.pageSize! - 1;
    const { data, count, error } = await query.range(start, end);
    if (error) {
      handleSupabaseError(error);
    }

    const totalCount = count || 0;
    return {
      items: (data || []).map(mapRow),
      totalCount,
      page: options!.page!,
      pageSize: options!.pageSize!,
      totalPages: Math.ceil(totalCount / options!.pageSize!)
    };
  },

  async fetchAnnouncementBySlug(
    slug: string,
    _bypassCache?: boolean
  ): Promise<AnnouncementRecord | null> {
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      handleSupabaseError(error);
    }
    if (!data) {
      return null;
    }

    return mapRow(data);
  },

  async addAnnouncement(data: Partial<AnnouncementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("announcements").insert({
      id: data.id || crypto.randomUUID(),
      creator_id: data.creatorId,
      start_date: toDbDate(data.startDate),
      expiry_date: toDbDate(data.expiryDate),
      is_indefinite: data.isIndefinite ?? false,
      is_admin_only: data.isAdminOnly ?? false,
      is_unlisted: data.isUnlisted ?? false,
      tags: data.tags ? data.tags.split(",") : [],
      title: data.title,
      content: data.content,
      slug: data.slug,
      broadcast_count: data.broadcastCount ?? 0
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateAnnouncement(id: string, data: Partial<AnnouncementRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.title !== undefined) {
      payload.title = data.title;
    }
    if (data.content !== undefined) {
      payload.content = data.content;
    }
    if (data.startDate !== undefined) {
      payload.start_date = toDbDate(data.startDate);
    }
    if (data.expiryDate !== undefined) {
      payload.expiry_date = toDbDate(data.expiryDate);
    }
    if (data.isIndefinite !== undefined) {
      payload.is_indefinite = data.isIndefinite;
    }
    if (data.isAdminOnly !== undefined) {
      payload.is_admin_only = data.isAdminOnly;
    }
    if (data.isUnlisted !== undefined) {
      payload.is_unlisted = data.isUnlisted;
    }
    if (data.tags !== undefined) {
      payload.tags = data.tags ? data.tags.split(",") : [];
    }
    if (data.slug !== undefined) {
      payload.slug = data.slug;
    }
    if (data.broadcastCount !== undefined) {
      payload.broadcast_count = data.broadcastCount;
    }

    const { data: updated, error } = await supabase
      .from("announcements")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Announcement not found");
  },

  async expireAnnouncement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("announcements")
      .update({ expiry_date: today, is_indefinite: false })
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Announcement not found");
  },

  async deleteAnnouncement(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("announcements").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Announcement not found");
  }
};
