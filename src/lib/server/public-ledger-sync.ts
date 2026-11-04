import { env } from "$env/dynamic/private";
import {
  PUBLIC_BRANDING,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import branding from "$srcPrivate/branding.json";
import { createClient } from "@supabase/supabase-js";

export interface PublicJournalEntry {
  entry_key: string;
  sort_seq: number;
  date: string;
  period: string;
  type: string;
  water: number;
  assoc: number;
  maintenance: number;
  gas: number;
  misc: number;
  amount: number;
  was_audited: boolean;
}

export interface PublicOfficerEntry {
  officer_key: string;
  sort_seq: number;
  term: string;
  position: string;
  display_name: string;
  committee: string | null;
  photo_url: string | null;
}

export interface PublicPortalSnapshotV1 {
  schema_version: 1;
  period: string;
  generated_at: string;
  journal: PublicJournalEntry[];
  officers: PublicOfficerEntry[];
}

export interface PublicSnapshotPreview {
  period: string;
  journalSourceCount: number;
  journalCount: number;
  journalExcludedCount: number;
  officerSourceCount: number;
  officerCount: number;
  officerExcludedCount: number;
  totals: {
    water: number;
    assoc: number;
    maintenance: number;
    gas: number;
    misc: number;
    balance: number;
  };
  snapshot: PublicPortalSnapshotV1;
}

const PAGE_SIZE = 1000;

const clean = (value: unknown) => String(value ?? "").trim();
const round = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const dateOnly = (value: unknown) => clean(value).slice(0, 10);

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sourceClient(request: Request) {
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("HAOne database is not configured");
  }

  // This is the authenticated Supabase session token, not HAOne's credential JWT.
  // Requiring the dedicated header prevents accidentally presenting the HAOne JWT
  // to Supabase and keeps all source reads subject to the current admin's RLS.
  const token = request.headers.get("x-supabase-access-token");
  if (!token) {
    throw new Error("Authenticated Supabase session is required");
  }

  return createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
}

function destinationClient() {
  if (!isPublicPortalConfigured()) {
    throw new Error("Public portal destination is not configured");
  }

  return createClient(env.SECONDARY_SUPABASE_URL, env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

export function isPublicPortalConfigured(): boolean {
  return Boolean(env.SECONDARY_SUPABASE_URL && env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY);
}

async function fetchEveryPage<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function publicDisplayName(row: { nickname?: unknown; name?: unknown }): string {
  const nickname = clean(row.nickname).replace(/^["']+|["']+$/g, "");
  if (nickname) return nickname;

  const fullName = clean(row.name);
  if (!fullName) return "";

  // The directory commonly stores names as "SURNAME, GIVEN NAMES". Only the
  // portion after the comma is safe for the public snapshot.
  const commaAt = fullName.indexOf(",");
  if (commaAt !== -1) return clean(fullName.slice(commaAt + 1));

  // For "Given Names Surname", remove the final token. A single token cannot
  // be safely classified as a given name and is therefore excluded.
  const parts = fullName.split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
}

function publicPhotoUrl(value: unknown): string | null {
  const candidate = clean(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    // Google Drive share links return an HTML viewer and cannot be used as an
    // image source. Convert known share formats to Drive's direct media URL.
    if (url.hostname === "drive.google.com") {
      const pathId = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
      const queryId = url.searchParams.get("id");
      const fileId = pathId || queryId;
      return fileId
        ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`
        : null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function configuredPositionOrder(): Map<string, number> {
  const profile = (branding as Record<string, any>)[PUBLIC_BRANDING] ?? {};
  const positions = Array.isArray(profile.officerPositions) ? profile.officerPositions : [];
  return new Map(
    positions.map((item: any, index: number) => [clean(item?.title).toLocaleLowerCase(), index])
  );
}

export async function getOfficialActiveTerm(request: Request): Promise<string> {
  const { data, error } = await sourceClient(request)
    .from("constants")
    .select("value")
    .eq("key", "TERM_CURR")
    .maybeSingle();

  if (error) throw error;
  return clean(data?.value);
}

export async function buildPublicSnapshotPreview(
  request: Request,
  period: string
): Promise<PublicSnapshotPreview> {
  const source = sourceClient(request);

  const [journalSource, officerSource] = await Promise.all([
    fetchEveryPage<any>((from, to) =>
      source
        .from("journal")
        .select("id,date,created_at,period,type,water,assoc,maintenance,gas,misc,was_audited")
        .eq("period", period)
        .order("date", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchEveryPage<any>((from, to) =>
      source
        .from("officers")
        .select("id,position,name,nickname,term,committee,status,photo_url,photo_auto_url")
        .eq("term", period)
        .eq("status", "ACTIVE")
        .order("id", { ascending: true })
        .range(from, to)
    )
  ]);

  const journal: PublicJournalEntry[] = [];
  for (const row of journalSource) {
    const date = dateOnly(row.date);
    const type = clean(row.type);
    if (!row.id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !type) continue;

    const water = round(row.water);
    const assoc = round(row.assoc);
    const maintenance = round(row.maintenance);
    const gas = round(row.gas);
    const misc = round(row.misc);

    journal.push({
      entry_key: await sha256(String(row.id)),
      sort_seq: journal.length + 1,
      date,
      period,
      type,
      water,
      assoc,
      maintenance,
      gas,
      misc,
      amount: round(water + assoc + maintenance + gas + misc),
      was_audited: Boolean(row.was_audited)
    });
  }

  const safeOfficers = officerSource
    .map((row) => ({
      sourceId: clean(row.id),
      position: clean(row.position),
      displayName: publicDisplayName(row),
      committee: clean(row.committee) || null,
      // A manually managed photo remains authoritative. Use the Google
      // AutoPhoto only when no valid manual URL is available.
      photoUrl: publicPhotoUrl(row.photo_url) ?? publicPhotoUrl(row.photo_auto_url)
    }))
    .filter((row) => row.sourceId && row.position && row.displayName);

  const positionOrder = configuredPositionOrder();
  safeOfficers.sort((a, b) => {
    const aOrder = positionOrder.get(a.position.toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = positionOrder.get(b.position.toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return (
      aOrder - bOrder ||
      a.position.localeCompare(b.position) ||
      a.displayName.localeCompare(b.displayName) ||
      a.sourceId.localeCompare(b.sourceId)
    );
  });

  const officers: PublicOfficerEntry[] = [];
  for (const [index, row] of safeOfficers.entries()) {
    officers.push({
      officer_key: await sha256(row.sourceId),
      sort_seq: index + 1,
      term: period,
      position: row.position,
      display_name: row.displayName,
      committee: row.committee,
      photo_url: row.photoUrl
    });
  }

  const totals = journal.reduce(
    (sum, row) => {
      sum.water += row.water;
      sum.assoc += row.assoc;
      sum.maintenance += row.maintenance;
      sum.gas += row.gas;
      sum.misc += row.misc;
      if (row.type.toUpperCase() !== "WAIVED") sum.balance += row.amount;
      return sum;
    },
    { water: 0, assoc: 0, maintenance: 0, gas: 0, misc: 0, balance: 0 }
  );

  return {
    period,
    journalSourceCount: journalSource.length,
    journalCount: journal.length,
    journalExcludedCount: journalSource.length - journal.length,
    officerSourceCount: officerSource.length,
    officerCount: officers.length,
    officerExcludedCount: officerSource.length - officers.length,
    totals: {
      water: round(totals.water),
      assoc: round(totals.assoc),
      maintenance: round(totals.maintenance),
      gas: round(totals.gas),
      misc: round(totals.misc),
      balance: round(totals.balance)
    },
    snapshot: {
      schema_version: 1,
      period,
      generated_at: new Date().toISOString(),
      journal,
      officers
    }
  };
}

export async function syncPublicSnapshot(request: Request, period: string) {
  const preview = await buildPublicSnapshotPreview(request, period);
  const { data, error } = await destinationClient().rpc("replace_public_snapshot", {
    p_snapshot: preview.snapshot
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (
    result?.success !== true ||
    result?.schema_version !== 1 ||
    result?.period !== period ||
    result?.journal_count !== preview.journalCount ||
    result?.officer_count !== preview.officerCount ||
    typeof result?.synced_at !== "string"
  ) {
    throw new Error("Public portal returned an invalid synchronization response");
  }

  const { snapshot: _snapshot, ...safePreview } = preview;
  return { ...safePreview, result };
}
