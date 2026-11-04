import { authenticateAdmin } from "$api/services/auth-service";
import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import {
  permanentlyDeletePublication,
  PortalCmsError,
  updatePublication,
  type PublicationStatus
} from "$lib/server/portal-publications";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function safeFailure(error: any, action: string) {
  if (error instanceof PortalCmsError) {
    return json({ error: error.message }, { status: error.status });
  }
  if (error?.code === "23505") {
    return json(
      { error: "The publication title or reference number already exists" },
      { status: 409 }
    );
  }
  console.error(`Portal publication ${action} failed:`, error);
  return json({ error: `Could not ${action} publication` }, { status: 500 });
}

export const PATCH: RequestHandler = async ({ request, params }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const publication = await updatePublication(params.id, {
      title: body.title,
      memoNumber: body.memoNumber,
      documentType: body.documentType,
      description: body.description,
      publishedAt: body.publishedAt,
      status: body.status as PublicationStatus,
      isFeatured: body.isFeatured
    });
    return json({ success: true, publication });
  } catch (error) {
    return safeFailure(error, "update");
  }
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const result = await permanentlyDeletePublication(params.id);
    return json(result, { status: result.success ? 200 : 207 });
  } catch (error) {
    return safeFailure(error, "delete");
  }
};
