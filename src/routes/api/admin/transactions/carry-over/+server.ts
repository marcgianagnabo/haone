import { authenticateAdmin } from "$api/services/auth-service";
import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import { TransactionType } from "$lib/types";
import { getLocalDateString } from "$utils/parsers";
import { isNextSemester } from "$utils/sort";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * Computes per-MOP fund balances that should be carried into the next term and
 * returns paired EOS (closing) + CARRYOVER (opening) journal entries.
 *
 * Carryover always lands on the semester immediately following the source
 * term (1S -> 2S -> Midyear -> next academic year's 1S).
 *
 * The math mirrors the manual EOS flow in TransactionForm.svelte and the
 * financial report (financial-report-pdf.ts): exclude EOS/CARRYOVER rows and
 * waived entries, drop N/A MOPs, then sum water/assoc/maintenance/misc per MOP.
 */

const EXCLUDED_TYPES = new Set([
  TransactionType.EOS,
  TransactionType.EOS_UNSETTLED,
  TransactionType.CARRYOVER
]);

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const normMop = (mop?: string | null) => (mop || "").trim().toUpperCase();
const isWaived = (type?: string | null) => (type || "").toUpperCase().includes("WAIVED");
const usableMop = (mop?: string | null) => {
  const m = normMop(mop);
  return m !== "" && m !== "N/A";
};

function summarize(
  rows: any[]
): Map<string, { water: number; assoc: number; maintenance: number; misc: number }> {
  const map = new Map<
    string,
    { water: number; assoc: number; maintenance: number; misc: number }
  >();
  for (const row of rows) {
    const mop = normMop(row.mop);
    const cur = map.get(mop) || { water: 0, assoc: 0, maintenance: 0, misc: 0 };
    cur.water = r2(cur.water + num(row.water));
    cur.assoc = r2(cur.assoc + num(row.assoc));
    cur.maintenance = r2(cur.maintenance + num(row.maintenance));
    cur.misc = r2(cur.misc + num(row.misc));
    map.set(mop, cur);
  }
  return map;
}

function carriedMopSet(rows: any[]): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    if (row.type === TransactionType.CARRYOVER) {
      set.add(normMop(row.mop));
    }
  }
  return set;
}

function buildCarryOver(sourceTerm: string, targetTerm: string, rows: any[], targetRows: any[]) {
  const balances = summarize(rows.filter((r) => !isWaived(r.type) && usableMop(r.mop)));
  const carried = carriedMopSet(targetRows);
  const date = getLocalDateString();

  const summary: {
    mop: string;
    water: number;
    assoc: number;
    maintenance: number;
    misc: number;
    total: number;
  }[] = [];
  const entries: {
    date: string;
    mop: string;
    period: string;
    type: TransactionType;
    water: number;
    assoc: number;
    maintenance: number;
    misc: number;
    notes: string;
    notesPrivate: string;
    prRefNo: string;
  }[] = [];
  const skipped: { mop: string; reason: string }[] = [];

  for (const [mop, bal] of balances) {
    const total = r2(bal.water + bal.assoc + bal.maintenance + bal.misc);
    if (total === 0) {
      continue;
    }
    if (carried.has(mop)) {
      skipped.push({ mop, reason: `Already has a CARRYOVER entry in ${targetTerm}` });
      continue;
    }
    summary.push({
      mop,
      water: bal.water,
      assoc: bal.assoc,
      maintenance: bal.maintenance,
      misc: bal.misc,
      total
    });
    entries.push(
      {
        date,
        mop,
        period: sourceTerm,
        type: TransactionType.EOS,
        water: -bal.water,
        assoc: -bal.assoc,
        maintenance: -bal.maintenance,
        misc: -bal.misc,
        notes: `EOS CARRYOVER TO ${targetTerm}`,
        notesPrivate: `End of term settlement: ${sourceTerm} → ${targetTerm}`,
        prRefNo: "N/A"
      },
      {
        date,
        mop,
        period: targetTerm,
        type: TransactionType.CARRYOVER,
        water: bal.water,
        assoc: bal.assoc,
        maintenance: bal.maintenance,
        misc: bal.misc,
        notes: `CARRYOVER FROM ${sourceTerm}`,
        notesPrivate: "",
        prRefNo: "N/A"
      }
    );
  }

  return { summary, entries, skipped };
}

async function fetchSupabaseRows(token: string, term: string): Promise<any[]> {
  const url = `${PUBLIC_SUPABASE_URL}/rest/v1/journal?select=*&period=eq.${encodeURIComponent(term)}`;
  const resp = await fetch(url, {
    headers: {
      apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`
    }
  });
  if (!resp.ok) {
    throw new Error(`Supabase read failed (${resp.status}): ${await resp.text()}`);
  }
  return await resp.json();
}

function toDbRow(e: any) {
  return {
    id: crypto.randomUUID(),
    date: e.date,
    creator_id: null,
    account_id: null,
    water: e.water,
    assoc: e.assoc,
    misc: e.misc,
    maintenance: e.maintenance,
    mop: e.mop,
    period: e.period,
    type: e.type,
    notes: e.notes,
    notes_private: e.notesPrivate || null,
    mop_ref_no: null,
    pr_date_issued: null,
    pr_ref_no: e.prRefNo || null,
    was_audited: false,
    receipt_url: null
  };
}

async function insertSupabaseRows(token: string, entries: any[]): Promise<void> {
  for (const entry of entries) {
    const resp = await fetch(`${PUBLIC_SUPABASE_URL}/rest/v1/journal`, {
      method: "POST",
      headers: {
        apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(toDbRow(entry))
    });
    if (!resp.ok) {
      throw new Error(`Supabase write failed (${resp.status}): ${await resp.text()}`);
    }
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const sourceTerm = String(body.sourceTerm || "").trim();
  const targetTerm = String(body.targetTerm || "").trim();
  const dryRun = body.dryRun === true;

  if (!sourceTerm || !targetTerm) {
    return json({ error: "Missing source or target term" }, { status: 400 });
  }
  if (sourceTerm === targetTerm) {
    return json({ error: "Source and target terms must be different" }, { status: 400 });
  }
  if (!isNextSemester(sourceTerm, targetTerm)) {
    return json(
      {
        error:
          "Carryover target must be the semester immediately following the source term (1S -> 2S -> Midyear -> next 1S)."
      },
      { status: 400 }
    );
  }

  try {
    const rows = await (async (): Promise<any> => {
      if (PUBLIC_DB_PROVIDER === "supabase") {
        const token = request.headers.get("x-supabase-access-token");
        if (!token) {
          throw new Error("Missing Supabase session token");
        }
        return await fetchSupabaseRows(token, sourceTerm);
      }
      const { journalService } = await import("$api/services/journal-service");
      return await journalService.fetchJournalEntries({ term: sourceTerm });
    })();

    const targetRows = await (async (): Promise<any> => {
      if (PUBLIC_DB_PROVIDER === "supabase") {
        const token = request.headers.get("x-supabase-access-token");
        return await fetchSupabaseRows(token!, targetTerm);
      }
      const { journalService } = await import("$api/services/journal-service");
      return await journalService.fetchJournalEntries({ term: targetTerm });
    })();

    const sourceList = Array.isArray(rows) ? rows : rows.items || [];
    const targetList = Array.isArray(targetRows) ? targetRows : targetRows.items || [];

    const { summary, entries, skipped } = buildCarryOver(
      sourceTerm,
      targetTerm,
      sourceList.filter((r: any) => !EXCLUDED_TYPES.has(r.type)),
      targetList
    );

    if (dryRun) {
      return json({
        success: true,
        dryRun: true,
        sourceTerm,
        targetTerm,
        summary,
        skipped,
        created: 0
      });
    }

    if (entries.length > 0) {
      if (PUBLIC_DB_PROVIDER === "supabase") {
        const token = request.headers.get("x-supabase-access-token")!;
        await insertSupabaseRows(token, entries);
      } else {
        const { journalService } = await import("$api/services/journal-service");
        for (const entry of entries) {
          await journalService.addJournalEntry(entry);
        }
      }
    }

    return json({
      success: true,
      dryRun: false,
      sourceTerm,
      targetTerm,
      summary,
      skipped,
      created: entries.length
    });
  } catch (e: any) {
    return json({ error: "Carry over failed", message: e.message }, { status: 500 });
  }
};
