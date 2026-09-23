import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import { auth } from "$state/auth.svelte";
import { brandingState } from "$state/branding.svelte";
import { isUuid } from "$utils/parsers";
import { createClient } from "@supabase/supabase-js";

export const isSupabase = PUBLIC_DB_PROVIDER === "supabase";

export function handleSupabaseError(error: any) {
  if (!error) return;
  const status = error.status || error.code;
  const msg = (error.message || "").toLowerCase();
  // Only a 401 / invalid JWT means the Supabase session is dead. A 403 is an
  // RLS denial for the current action and must NOT tear down the session.
  if (
    status === 401 ||
    status === "PGRST301" ||
    msg.includes("jwt expired") ||
    msg.includes("invalid token")
  ) {
    auth.signOutWithMessage(
      "Session Expired",
      "Your session or authorization is invalid. Please sign in again."
    );
    throw new Error("Your session or authorization is invalid. Please sign in again.");
  }
  throw error;
}

/**
 * Throws `message` when a Supabase mutation matched zero rows, mirroring the
 * "X not found" errors thrown by the Sheets implementations.
 */
export function assertSupabaseFound(data: any[] | null, message: string) {
  if (!data || data.length === 0) {
    throw new Error(message);
  }
}

const SUPABASE_PAGE_SIZE = 1000;

/**
 * Fetches ALL rows of a Supabase query, paging past the PostgREST default
 * 1000-row cap. The query built by `buildQuery` MUST include a deterministic
 * `.order()` for stable pagination.
 */
export async function fetchAllSupabaseRows<T = any>(buildQuery: () => any): Promise<T[]> {
  if (!supabase) {
    return [];
  }
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery().range(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      handleSupabaseError(error);
    }
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    from += SUPABASE_PAGE_SIZE;
  }
  return all;
}

export const supabase =
  PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        global: {
          fetch: async (url, options) => {
            const response = await fetch(url, options);
            // Only a 401 means the session/JWT is invalid. A 403 is an
            // RLS denial for the current action and must NOT end the session.
            if (response.status === 401) {
              auth.signOutWithMessage(
                "Session Expired",
                "Your session has expired. Please sign in again."
              );
            }
            return response;
          }
        }
      })
    : null;

/**
 * Resolves a user reference (UUID, email, or student number) to a real
 * public.users id. `emailFallback` is only tried when the primary value does
 * not resolve (e.g. a dummy id minted by the token endpoint for a user with no
 * users row). Returns null when nothing matches so callers can store NULL in
 * journal.creator_id / journal.account_id instead of tripping the FK.
 */
export async function resolveSupabaseUserId(
  value?: string | null,
  emailFallback?: string | null
): Promise<string | null> {
  if (!supabase) {
    return null;
  }

  const candidates: string[] = [];
  const primary = (value || "").trim();
  if (primary) {
    candidates.push(primary);
  }
  const fallback = (emailFallback || "").trim();
  if (fallback && fallback !== primary) {
    candidates.push(fallback);
  }

  for (const candidate of candidates) {
    if (isUuid(candidate)) {
      const { data } = await supabase
        .from("users_view")
        .select("id")
        .eq("id", candidate)
        .maybeSingle();
      if (data?.id) {
        return data.id;
      }
    } else {
      const { data } = await supabase
        .from("users_view")
        .select("id")
        .or(`email.ilike.${candidate},student_no.ilike.${candidate}`)
        .maybeSingle();
      if (data?.id) {
        return data.id;
      }
    }
  }

  return null;
}

// ── GSheets API Client ───────────────────────────────────────────────────────

let sheetsCache: Record<string, string[][]> = {};

/**
 * Clears the session-based Sheets data cache.
 */
export function invalidateCache() {
  sheetsCache = {};
}

/**
 * Incrementally remove a row from all cached ranges for a specific sheet.
 */
function deleteRowFromCache(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const prefix = `${spreadsheetId}:${sheetName}!`;
  for (const cacheKey in sheetsCache) {
    if (!cacheKey.startsWith(prefix)) {
      continue;
    }
    const data = sheetsCache[cacheKey];
    const cached = parseA1Range(cacheKey.slice(spreadsheetId.length + 1));
    if (!data || !cached) {
      continue;
    }
    const relRow = rowIndex - cached.startRow;
    if (relRow >= 0 && relRow < data.length) {
      data.splice(relRow, 1);
    }
  }
}

/**
 * Converts Column Letter (A, B, AA) to 0-indexed number.
 */
function colToNum(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num - 1;
}

interface ParsedA1Range {
  sheetName: string;
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

/**
 * Parses an A1 range like "accounts!A:L", "accounts!D5:E5", or "settings!B5".
 * Missing row numbers mean the range is open-ended (startRow 0, endRow +inf).
 */
function parseA1Range(range: string): ParsedA1Range | null {
  const parts = range.split("!");
  if (parts.length !== 2) {
    return null;
  }
  const m = parts[1].match(/^([A-Z]+)(\d+)?(?::([A-Z]+)?(\d+)?)?$/);
  if (!m) {
    return null;
  }
  const startCol = colToNum(m[1]);
  const startRow = m[2] ? parseInt(m[2]) - 1 : 0;
  const endCol = m[3] ? colToNum(m[3]) : startCol;
  const endRow = m[4] ? parseInt(m[4]) - 1 : Number.MAX_SAFE_INTEGER;
  return { sheetName: parts[0], startCol, startRow, endCol, endRow };
}

/**
 * Surgically update a range of cells in any cached range for a given sheet.
 */
export function patchCacheRange(spreadsheetId: string, range: string, values: any[][]) {
  const patch = parseA1Range(range);
  if (!patch) {
    return;
  }

  const prefix = `${spreadsheetId}:${patch.sheetName}!`;

  for (const cacheKey in sheetsCache) {
    if (!cacheKey.startsWith(prefix)) {
      continue;
    }
    const data = sheetsCache[cacheKey];
    const cached = parseA1Range(cacheKey.slice(spreadsheetId.length + 1));
    if (!data || !cached) {
      continue;
    }

    let invalidate = false;
    for (let r = 0; r < values.length && !invalidate; r++) {
      const relRow = patch.startRow + r - cached.startRow;
      if (relRow < 0) {
        continue;
      }
      if (relRow >= data.length) {
        // If appending contiguous rows to an open-ended cached range, push new rows in place
        if (cached.endRow === Number.MAX_SAFE_INTEGER && relRow === data.length) {
          data.push([]);
        } else {
          invalidate = true;
          break;
        }
      }
      for (let c = 0; c < values[r].length; c++) {
        const relCol = patch.startCol + c - cached.startCol;
        // Skip cells outside the cached range's declared column span (e.g. an
        // accounts!F write must not reshape a cached accounts!A:C range).
        if (relCol < 0 || relCol > cached.endCol - cached.startCol) {
          continue;
        }
        const value = values[r][c];
        if (relCol >= data[relRow].length) {
          // The Sheets API trims trailing empty cells; extend the row only when
          // the incoming value is non-empty.
          if (value === "" || value === null || value === undefined) {
            continue;
          }
          const padding = new Array(relCol - data[relRow].length).fill("");
          data[relRow].push(...padding);
        }
        data[relRow][relCol] = value === null || value === undefined ? "" : String(value);
      }
    }

    if (invalidate) {
      delete sheetsCache[cacheKey];
    }
  }
}

/**
 * Standard error handling for Google API responses.
 */
async function handleResponseError(resp: Response, defaultMessage: string) {
  if (resp.status === 401) {
    const message = "Your session has expired. Please sign in again.";
    auth.signOutWithMessage("Session Expired", message);
    throw new Error(message);
  }
  if (resp.status === 403) {
    const replyTo = brandingState.profile.replyTo || "";
    const message = `You do not have permission to use this platform. Please contact the administrator via <a href="mailto:${replyTo}">email</a>.`;
    auth.signOutWithMessage("Access Denied", message);
    throw new Error(message);
  }
  if (resp.status === 429) {
    throw new Error("Too many requests. Please wait a moment before trying again.");
  }
  let message = defaultMessage;
  try {
    const err = await resp.json();
    message = err.error?.message || defaultMessage;
  } catch (e) {
    // Fallback if not JSON
  }
  throw new Error(message);
}

/**
 * Standard fetch with auth and error handling.
 */
export async function fetchWithAuth(
  url: string,
  defaultError: string,
  init: RequestInit = {},
  explicitToken?: string
) {
  const token = explicitToken || auth.accessToken;
  if (!token) {
    throw new Error("Not authenticated");
  }

  const resp = await fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`
    }
  });

  if (!resp.ok) {
    await handleResponseError(resp, defaultError);
  }

  return resp;
}

/**
 * Probe checking read access on a spreadsheet metadata endpoint without parsing rows.
 */
export async function verifySpreadsheetAccess(
  spreadsheetId: string,
  explicitToken?: string
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`;
  await fetchWithAuth(url, "Spreadsheet access verification failed", {}, explicitToken);
}

/**
 * Enhanced fetch to return raw values as well, to help with row indexing.
 * Includes session-based caching.
 */
export async function fetchSheetRowsRaw(
  spreadsheetId: string,
  range: string,
  bypassCache = false,
  explicitToken?: string
): Promise<string[][]> {
  const cacheKey = `${spreadsheetId}:${range}`;
  if (!bypassCache && sheetsCache[cacheKey]) {
    return sheetsCache[cacheKey];
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetchWithAuth(url, "Failed to fetch sheet data", {}, explicitToken);

  const data = await resp.json();
  const values = data.values || [];
  sheetsCache[cacheKey] = values;
  return values;
}

/**
 * Updates a specific range (e.g., a cell or row) in the sheet.
 */
export async function updateSheetValue(spreadsheetId: string, range: string, values: any[][]) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const resp = await fetchWithAuth(url, "Failed to update sheet", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  const res = await resp.json();
  patchCacheRange(spreadsheetId, range, values);
  return res;
}

/**
 * Performs multiple updates in a single request.
 */
export async function batchUpdateValues(
  spreadsheetId: string,
  data: { range: string; values: any[][] }[]
) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

  const resp = await fetchWithAuth(url, "Failed to batch update sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data
    })
  });

  const res = await resp.json();
  if (data && Array.isArray(data)) {
    for (const update of data) {
      patchCacheRange(spreadsheetId, update.range, update.values);
    }
  }
  return res;
}

/**
 * Appends a row to a specific sheet.
 */
export async function appendSheetRow(spreadsheetId: string, range: string, values: any[][]) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const resp = await fetchWithAuth(url, "Failed to append row", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values })
  });

  const res = await resp.json();
  if (res.updates?.updatedRange) {
    patchCacheRange(spreadsheetId, res.updates.updatedRange, values);
  } else {
    // Without an updatedRange we cannot patch precisely; drop cached ranges
    // for this sheet so the next read refetches instead of serving stale data.
    const prefix = `${spreadsheetId}:${range.split("!")[0]}!`;
    for (const cacheKey in sheetsCache) {
      if (cacheKey.startsWith(prefix)) {
        delete sheetsCache[cacheKey];
      }
    }
  }
  return res;
}

/**
 * Deletes a row from a specific sheet by its index.
 */
export async function deleteSheetRow(spreadsheetId: string, sheetName: string, rowIndex: number) {
  const token = auth.accessToken;
  if (!token) throw new Error("Not authenticated");

  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch spreadsheet metadata");

  const data = await metaResp.json();

  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const sheetId = sheet.properties.sheetId;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  const resp = await fetchWithAuth(url, "Failed to delete row", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1
            }
          }
        }
      ]
    })
  });

  const res = await resp.json();
  deleteRowFromCache(spreadsheetId, sheetName, rowIndex);
  return res;
}

/**
 * Creates a new Google Spreadsheet.
 */
export async function createNewSpreadsheet(title: string, sheetTitle?: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets`;
  const sheets = sheetTitle ? [{ properties: { title: sheetTitle } }] : [];

  const resp = await fetchWithAuth(url, "Failed to create spreadsheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title },
      sheets
    })
  });
  return await resp.json();
}

/**
 * Ensures a sheet with the given title exists in the spreadsheet.
 */
export async function ensureSheetExists(spreadsheetId: string, title: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const resp = await fetchWithAuth(url, "Failed to fetch spreadsheet metadata");
  const data = await resp.json();

  const exists = data.sheets?.some((s: any) => s.properties.title === title);
  if (exists) return;

  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(updateUrl, "Failed to create new sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: { title }
          }
        }
      ]
    })
  });
}

/**
 * Formats a report sheet with frozen headers, bold text, and auto-resized columns.
 */
export async function formatReportSheet(
  spreadsheetId: string,
  sheetName: string,
  rowCount: number,
  colCount: number
) {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`;
  const metaResp = await fetchWithAuth(metaUrl, "Failed to fetch metadata");
  const data = await metaResp.json();
  const sheet = data.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) return;
  const sheetId = sheet.properties.sheetId;

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetchWithAuth(url, "Failed to format sheet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount"
          }
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: colCount
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                textFormat: { bold: true, fontSize: 10 }
              }
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)"
          }
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: colCount }
          }
        }
      ]
    })
  });
}
