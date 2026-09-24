import { getFirebaseToken, getSheetsClient } from "$api/services/auth-service";
import {
  fetchGoogleAPI,
  getSheetValues,
  updateSheetValue
} from "$api/services/server-sheets-service";
import { supabase } from "$api/services/common";
import { GOOGLE_SERVICE_ACCOUNT_JSON, VAPID_PRIVATE_KEY } from "$env/static/private";
import {
  PUBLIC_BRANDING,
  PUBLIC_DB_PROVIDER,
  PUBLIC_GS_SR_ID,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL,
  PUBLIC_VAPID_PUBLIC_KEY
} from "$env/static/public";
import { ANNOUNCEMENT_COL, AnnouncementStatus, LAUNDRY_COL } from "$lib/types";
import branding from "$srcPrivate/branding.json";
import {
  buildPushPayload,
  type PushMessage,
  type PushSubscription,
  type VapidKeys
} from "@block65/webcrypto-web-push";
import dayjs from "dayjs";

const brandingProfile = (branding as any)[PUBLIC_BRANDING];

const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
const PROJECT_ID = keys.project_id;
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * Sends a push notification to a specific resident.
 */
export async function notifyResident(
  residentId: string,
  title: string,
  body: string,
  url: string = "/resident/laundry"
) {
  if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error("VAPID keys not configured");
    return;
  }

  try {
    const token = await getFirebaseToken();

    // Query Firestore for subscriptions matching residentId
    const query = {
      structuredQuery: {
        from: [{ collectionId: "push_subscriptions" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "residentId" },
            op: "EQUAL",
            value: { stringValue: residentId }
          }
        }
      }
    };

    const resp = await fetchGoogleAPI(`${BASE_URL}:runQuery`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query)
    });

    const results = await resp.json();

    for (const result of results) {
      if (!result.document) {
        continue;
      }

      const docName = result.document.name;
      const fields = result.document.fields;
      const endpoint = fields.endpoint?.stringValue;
      const p256dh = fields.p256dh?.stringValue;
      const auth = fields.auth?.stringValue;

      if (!endpoint || !p256dh || !auth) {
        continue;
      }

      const subscription: PushSubscription = {
        endpoint,
        expirationTime: null,
        keys: { p256dh, auth }
      };

      const message: PushMessage = {
        data: JSON.stringify({ title, body, url }),
        options: { ttl: 86400 }
      };
      const vapid: VapidKeys = {
        subject: `mailto:${brandingProfile.replyTo}`,
        publicKey: PUBLIC_VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY
      };

      try {
        const payload = await buildPushPayload(message, subscription, vapid);
        const pushResp = await fetch(endpoint, payload as any);

        if (!pushResp.ok) {
          if (pushResp.status === 404 || pushResp.status === 410) {
            console.warn(`[Push] Subscription expired for ${residentId}, deleting.`);
            await fetchGoogleAPI(`https://firestore.googleapis.com/v1/${docName}`, token, {
              method: "DELETE"
            });
          }
        }
      } catch (err: any) {
        console.error("Push delivery failed:", err);
      }
    }
  } catch (e) {
    console.error("NotifyResident failed:", e);
  }
}

/**
 * Sends a push notification to all subscribers.
 */
export async function notifyAllResidents(
  title: string,
  body: string,
  url: string = "/resident/announcements"
): Promise<{ sentCount: number; foundCount: number }> {
  if (!PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sentCount: 0, foundCount: 0 };
  }

  const token = await getFirebaseToken();
  const resp = await fetchGoogleAPI(`${BASE_URL}/push_subscriptions?pageSize=1000`, token);
  const data = await resp.json();

  if (!data.documents) {
    console.warn(
      `[Push] notifyAllResidents: Firestore returned no documents field. Response keys: ${Object.keys(data).join(",")}`
    );
    return { sentCount: 0, foundCount: 0 };
  }

  const foundCount = data.documents.length;
  let sentCount = 0;

  for (const doc of data.documents) {
    const docName = doc.name;
    const fields = doc.fields;
    const endpoint = fields.endpoint?.stringValue;
    const p256dh = fields.p256dh?.stringValue;
    const auth = fields.auth?.stringValue;

    if (!endpoint || !p256dh || !auth) {
      continue;
    }

    const subscription: PushSubscription = {
      endpoint,
      expirationTime: null,
      keys: { p256dh, auth }
    };

    const message: PushMessage = {
      data: JSON.stringify({ title, body, url }),
      options: { ttl: 86400 }
    };
    const vapid: VapidKeys = {
      subject: `mailto:${brandingProfile.replyTo}`,
      publicKey: PUBLIC_VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY
    };

    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const pushResp = await fetch(endpoint, payload as any);

      if (pushResp.ok) {
        sentCount++;
      } else {
        const errorText = await pushResp.text();
        console.error(`[Push] Delivery failed (${pushResp.status}): ${errorText}`);
        if (pushResp.status === 404 || pushResp.status === 410) {
          await fetchGoogleAPI(`https://firestore.googleapis.com/v1/${docName}`, token, {
            method: "DELETE"
          });
        }
      }
    } catch (err: any) {
      console.error("Push delivery failed:", err);
    }
  }
  return { sentCount, foundCount };
}

/**
 * Maps a Supabase `announcements` row into the same A:M array shape used by the
 * Sheets-backed announcement task.
 */
function supabaseRowToArray(row: any): string[] {
  const out = new Array(13).fill("");
  out[ANNOUNCEMENT_COL.ID] = row.id || "";
  out[ANNOUNCEMENT_COL.CREATOR_ID] = row.creator_id || "";
  out[ANNOUNCEMENT_COL.DATE_CREATED] = row.created_at || "";
  out[ANNOUNCEMENT_COL.START_DATE] = row.start_date || "";
  out[ANNOUNCEMENT_COL.EXPIRY_DATE] = row.expiry_date || "";
  out[ANNOUNCEMENT_COL.IS_INDEFINITE] = row.is_indefinite ? "TRUE" : "FALSE";
  out[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = row.is_admin_only ? "TRUE" : "FALSE";
  out[ANNOUNCEMENT_COL.TAGS] = Array.isArray(row.tags) ? row.tags.join(",") : row.tags || "";
  out[ANNOUNCEMENT_COL.TITLE] = row.title || "";
  out[ANNOUNCEMENT_COL.CONTENT] = row.content || "";
  out[ANNOUNCEMENT_COL.IS_UNLISTED] = row.is_unlisted ? "TRUE" : "FALSE";
  out[ANNOUNCEMENT_COL.SLUG] = row.slug || "";
  out[ANNOUNCEMENT_COL.BROADCAST_COUNT] = String(row.broadcast_count ?? 0);
  return out;
}

/**
 * Task to check for newly active announcements and notify residents.
 */
export async function runAnnouncementNotifications(
  ids?: string[],
  supabaseToken?: string
): Promise<{
  sentCount: number;
  foundCount: number;
}> {
  let totalSent = 0;
  let totalFound = 0;
  const isSupabase = PUBLIC_DB_PROVIDER === "supabase";
  let rows: any[][] = [];
  let sheetClient: string | null = null;

  if (isSupabase && supabaseToken) {
    const resp = await fetch(
      `${PUBLIC_SUPABASE_URL}/rest/v1/announcements?select=*&order=created_at.desc`,
      {
        headers: {
          apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${supabaseToken}`
        }
      }
    );
    if (!resp.ok) {
      throw new Error(`Supabase read failed (${resp.status}): ${await resp.text()}`);
    }
    rows = ((await resp.json()) || []).map(supabaseRowToArray);
  } else if (isSupabase) {
    if (!supabase) {
      throw new Error("Supabase client not configured");
    }
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    rows = (data || []).map(supabaseRowToArray);
  } else {
    const client = await getSheetsClient();
    sheetClient = client;
    const all = await getSheetValues(client, PUBLIC_GS_SR_ID, "announcements!A:M");
    rows = (all || []).slice(1);
  }

  if (!rows || rows.length === 0) {
    console.log(`[Announcement Task] No announcement rows found. Supabase provider: ${isSupabase}`);
    return { sentCount: totalSent, foundCount: totalFound };
  }

  const now = dayjs();
  console.log(`[Announcement Task] Processing ${rows.length} rows. Filter IDs:`, ids);

  for (const [rowNumber, row] of rows.entries()) {
    const id = row[ANNOUNCEMENT_COL.ID];
    const title = row[ANNOUNCEMENT_COL.TITLE];
    const slug = row[ANNOUNCEMENT_COL.SLUG];
    const start = row[ANNOUNCEMENT_COL.START_DATE]
      ? dayjs(row[ANNOUNCEMENT_COL.START_DATE])
      : null;
    const expiry = row[ANNOUNCEMENT_COL.EXPIRY_DATE]
      ? dayjs(row[ANNOUNCEMENT_COL.EXPIRY_DATE])
      : null;
    const isIndefinite = row[ANNOUNCEMENT_COL.IS_INDEFINITE] === "TRUE";
    const broadcastCount = parseInt(row[ANNOUNCEMENT_COL.BROADCAST_COUNT]) || 0;
    const isUnlisted = row[ANNOUNCEMENT_COL.IS_UNLISTED] === "TRUE";

    let status = AnnouncementStatus.EXPIRED;
    if (start && start.isAfter(now)) {
      status = AnnouncementStatus.FUTURE;
    } else if (isIndefinite) {
      status = AnnouncementStatus.ACTIVE;
    } else if (!expiry || expiry.isAfter(now) || expiry.isSame(now)) {
      status = AnnouncementStatus.ACTIVE;
    }

    const isActive = status === AnnouncementStatus.ACTIVE;
    const isExplicitlyRequested = ids && ids.includes(id);
    const shouldNotifyAutomatically = !ids && isActive && !isUnlisted;

    if (isExplicitlyRequested || shouldNotifyAutomatically) {
      console.log(
        `[Announcement Task] WILL NOTIFY id="${id}" (explicit=${!!isExplicitlyRequested}, auto=${shouldNotifyAutomatically})`
      );
      if (totalSent > 0) {
        // Add a small delay between multiple notifications to avoid browser grouping/coalescing
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const content = row[ANNOUNCEMENT_COL.CONTENT] || "";
      const textContent = content.replace(/<[^>]*>?/gm, "").substring(0, 60) + "…";

      console.log(
        `[Announcement Task] NOTIFYING: "${title}" (ID: ${id}, Explicit: ${!!isExplicitlyRequested})`
      );

      const result = await notifyAllResidents(
        title,
        textContent,
        `/resident/announcements/${slug}`
      );

      console.log(`[Push] Found: ${result.foundCount}, Sent: ${result.sentCount}`);
      totalFound += result.foundCount;
      totalSent += result.sentCount;

      // Increment broadcast count only if at least one notification was sent
      if (result.sentCount > 0) {
        if (isSupabase && supabaseToken) {
          const upd = await fetch(
            `${PUBLIC_SUPABASE_URL}/rest/v1/announcements?id=eq.${encodeURIComponent(id)}`,
            {
              method: "PATCH",
              headers: {
                apikey: PUBLIC_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${supabaseToken}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal"
              },
              body: JSON.stringify({ broadcast_count: broadcastCount + 1 })
            }
          );
          if (!upd.ok) {
            throw new Error(`Supabase update failed (${upd.status}): ${await upd.text()}`);
          }
        } else if (isSupabase && supabase) {
          await supabase
            .from("announcements")
            .update({ broadcast_count: broadcastCount + 1 })
            .eq("id", id);
        } else if (sheetClient) {
          // rows is 0-indexed data (header already stripped); sheet row is +2
          await updateSheetValue(sheetClient, PUBLIC_GS_SR_ID, `announcements!M${rowNumber + 2}`, [
            [(broadcastCount + 1).toString()]
          ]);
        }
      }
    }
  }
  return { sentCount: totalSent, foundCount: totalFound };
}

/**
 * Task to check for upcoming laundry slots and send reminders.
 */
export async function runLaundryReminders() {
  try {
    const client = await getSheetsClient();
    // Fetch all laundry reservations
    const rows = await getSheetValues(client, PUBLIC_GS_SR_ID, "laundry!A:K");
    if (!rows || rows.length <= 1) {
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Process rows
    for (const row of rows.slice(1)) {
      const status = row[LAUNDRY_COL.STATUS];
      const date = row[LAUNDRY_COL.DATE];
      const timeStartStr = row[LAUNDRY_COL.TIME_START];
      const residentId = row[LAUNDRY_COL.RESIDENT_ID];

      if (status !== "ACTIVE" || date !== todayStr) {
        continue;
      }

      // Parse time (e.g., "09:00")
      const [hour, min] = timeStartStr.split(":").map(Number);
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min);

      const diffMinutes = (startTime.getTime() - now.getTime()) / 60000;

      // Notify if slot starts in 15-30 minutes
      if (diffMinutes > 0 && diffMinutes <= 30) {
        console.log(`[Reminder] Upcoming slot for ${residentId} at ${timeStartStr}`);
        await notifyResident(
          residentId,
          "Laundry Reminder",
          `Your laundry slot starts at ${timeStartStr}. Get ready!`,
          "/resident/laundry"
        );
      }
    }
  } catch (e) {
    console.error("Laundry reminders task failed:", e);
  }
}

export const notificationsController = {
  notifyResident,
  notifyAllResidents,
  runAnnouncementNotifications,
  runLaundryReminders
};
