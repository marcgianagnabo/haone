import { authenticateAdmin } from "$api/services/auth-service";
import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import { PortalCmsError, regeneratePublicationPreview } from "$lib/server/portal-publications";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, params }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    return json({ success: true, ...(await regeneratePublicationPreview(params.id)) });
  } catch (error: any) {
    if (error instanceof PortalCmsError) {
      return json({ error: error.message }, { status: error.status });
    }
    console.error("Portal publication preview regeneration failed:", error);
    return json({ error: "Could not regenerate the publication preview" }, { status: 500 });
  }
};
