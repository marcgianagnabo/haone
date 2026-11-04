import { authenticateAdmin } from "$api/services/auth-service";
import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import {
  getPortalHomepage,
  portalHomepageConfig,
  PortalHomepageError,
  updatePortalHomepage
} from "$lib/server/portal-homepage";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function failure(error: any) {
  if (error instanceof PortalHomepageError)
    return json({ error: error.message }, { status: error.status });
  console.error("Portal homepage operation failed:", error);
  return json({ error: "Could not update portal homepage" }, { status: 500 });
}

export const GET: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;
  try {
    const config = portalHomepageConfig();
    return json({
      configured: config.configured,
      maxImageBytes: config.maxImageBytes,
      ...(config.configured ? await getPortalHomepage() : {})
    });
  } catch (error) {
    return failure(error);
  }
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;
  try {
    const form = await request.formData();
    const candidate = form.get("image");
    return json({
      success: true,
      ...(await updatePortalHomepage({
        heading: String(form.get("heading") ?? ""),
        subheading: String(form.get("subheading") ?? ""),
        removeImage: String(form.get("removeImage") ?? "false") === "true",
        image: candidate instanceof File && candidate.size ? candidate : undefined
      }))
    });
  } catch (error) {
    return failure(error);
  }
};
