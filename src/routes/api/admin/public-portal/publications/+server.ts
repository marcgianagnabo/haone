import { authenticateAdmin } from "$api/services/auth-service";
import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import {
  createPublication,
  listPublications,
  PortalCmsError,
  portalPublicationConfig,
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

export const GET: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const config = portalPublicationConfig();
    return json({
      configured: config.configured,
      databaseConfigured: config.databaseConfigured,
      uploadConfigured: config.uploadConfigured,
      previewConfigured: config.previewConfigured,
      maxPdfBytes: config.maxPdfBytes,
      maxPreviewBytes: config.maxPreviewBytes,
      publications: config.databaseConfigured ? await listPublications() : []
    });
  } catch (error) {
    return safeFailure(error, "list");
  }
};

export const POST: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticateAdmin(request);
  if (auth.error) return auth.error;

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new PortalCmsError("Select a PDF file");

    const result = await createPublication(
      {
        title: String(form.get("title") ?? ""),
        memoNumber: String(form.get("memoNumber") ?? ""),
        documentType: String(form.get("documentType") ?? ""),
        description: String(form.get("description") ?? ""),
        publishedAt: String(form.get("publishedAt") ?? ""),
        status: String(form.get("status") ?? "draft") as PublicationStatus,
        isFeatured: String(form.get("isFeatured") ?? "false") === "true"
      },
      file
    );
    return json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    return safeFailure(error, "create");
  }
};
