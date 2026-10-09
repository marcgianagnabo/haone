import type { OfficerRecord } from "$lib/types";
import { OfficerStatus } from "$lib/types";
import { auth } from "$state/auth.svelte";
import { parseDbDate } from "$utils/parsers";
import {
  assertSupabaseFound,
  fetchAllSupabaseRows,
  handleSupabaseError,
  supabase
} from "../common";
import type { OfficerServiceInterface } from "../interfaces/officer-service.interface";

function mapRow(row: any): OfficerRecord {
  return {
    id: row.id,
    position: row.position || "",
    name: row.name || "",
    nickname: row.nickname || "",
    email: row.email || "",
    fbLink: row.fb_link || "",
    term: row.term || "",
    committee: row.committee || "",
    birthday: row.birthday || "",
    status: row.status || OfficerStatus.ACTIVE,
    photoUrl: row.photo_url || "",
    photoAutoUrl: row.photo_auto_url || "",
    raw: row
  };
}

export const supabaseOfficerService: OfficerServiceInterface = {
  async fetchOfficers(_bypassCache = false): Promise<OfficerRecord[]> {
    if (!supabase) {
      return [];
    }

    // Residents get the reduced directory shape (no emails/links/birthdays),
    // mirroring the Sheets server route.
    if (auth.isResident) {
      const { data: constData } = await supabase
        .from("constants")
        .select("value")
        .eq("key", "TERM_CURR")
        .maybeSingle();
      const activeTerm = constData?.value || "";

      const { data, error } = await supabase
        .from("officers")
        .select(
          "id, position, name, nickname, term, committee, status, photo_url, photo_auto_url, created_at"
        )
        .eq("status", OfficerStatus.ACTIVE)
        .eq("term", activeTerm)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        handleSupabaseError(error);
      }
      return (data || [])
        .filter((row: any) => row.position)
        .map((row: any) => ({
          ...mapRow(row),
          email: "",
          fbLink: "",
          birthday: ""
        }));
    }

    const sb = supabase;
    const data = await fetchAllSupabaseRows(() =>
      sb
        .from("officers")
        .select("*")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
    );
    return data.filter((row: any) => (row.email || "").trim() !== "").map(mapRow);
  },

  async addOfficer(data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("officers").insert({
      id: data.id || crypto.randomUUID(),
      position: data.position,
      name: data.name,
      nickname: data.nickname,
      email: data.email,
      fb_link: data.fbLink,
      term: data.term,
      committee: data.committee,
      birthday: parseDbDate(data.birthday),
      photo_url: data.photoUrl || null,
      status: data.status || OfficerStatus.ACTIVE
    });
    if (error) {
      handleSupabaseError(error);
    }
  },

  async updateOfficer(id: string, data: Partial<OfficerRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload: Record<string, any> = {};
    if (data.position !== undefined) {
      payload.position = data.position;
    }
    if (data.name !== undefined) {
      payload.name = data.name;
    }
    if (data.nickname !== undefined) {
      payload.nickname = data.nickname;
    }
    if (data.email !== undefined) {
      payload.email = data.email;
    }
    if (data.fbLink !== undefined) {
      payload.fb_link = data.fbLink;
    }
    if (data.term !== undefined) {
      payload.term = data.term;
    }
    if (data.committee !== undefined) {
      payload.committee = data.committee;
    }
    if (data.birthday !== undefined) {
      payload.birthday = parseDbDate(data.birthday);
    }
    if (data.photoUrl !== undefined) {
      payload.photo_url = data.photoUrl || null;
    }
    if (data.photoAutoUrl !== undefined) {
      payload.photo_auto_url = data.photoAutoUrl || null;
    }
    if (data.status !== undefined) {
      payload.status = data.status;
    }

    const { data: updated, error } = await supabase
      .from("officers")
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Officer not found");
  },

  async deleteOfficer(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("officers").delete().eq("id", id).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Officer not found");
  },

  async fillAutoPhoto(email: string, photoUrl: string): Promise<void> {
    if (!supabase || !email || !photoUrl) {
      return;
    }
    // No assert: residents' sessions match no rows under RLS and that is fine.
    const { error } = await supabase
      .from("officers")
      .update({ photo_auto_url: photoUrl })
      .ilike("email", email);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
