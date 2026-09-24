import { runAnnouncementNotifications } from "$api/controllers/notifications-controller";
import { authenticateAdmin } from "$api/services/auth-service";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * POST: Manually trigger announcement notifications.
 * Restricted to authenticated admins.
 */
export const POST: RequestHandler = async ({ request }) => {
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : undefined;
    const supabaseToken = request.headers.get("x-supabase-access-token") || undefined;
    console.log(`[Broadcast API] Triggering for IDs:`, ids);

    const { sentCount, foundCount } = await runAnnouncementNotifications(ids, supabaseToken);
    return json({
      success: true,
      message: `Notifications broadcasted successfully to ${sentCount} of ${foundCount} subscriber(s).`,
      count: sentCount,
      found: foundCount
    });
  } catch (e: any) {
    return json({ error: "Broadcast failed", message: e.message }, { status: 500 });
  }
};
