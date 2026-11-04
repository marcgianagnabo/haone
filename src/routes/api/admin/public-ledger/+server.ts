import { authenticatePortalAdmin } from "$lib/server/portal-admin-auth";
import { isPortalFeatureEnabled } from "$lib/server/portal-feature";
import {
  buildPublicSnapshotPreview,
  getOfficialActiveTerm,
  isPublicPortalConfigured,
  syncPublicSnapshot
} from "$lib/server/public-ledger-sync";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const activeTermError = "Only the official active term can be synchronized";

async function validateActiveTerm(request: Request): Promise<string> {
  const body = await request.json().catch(() => ({}));
  const requested = String(body?.period ?? "").trim();
  const official = await getOfficialActiveTerm(request);

  if (!official || requested !== official) throw new Error(activeTermError);
  return official;
}

export const GET: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticatePortalAdmin(request);
  if (auth.error) return auth.error;

  // Deliberately does not query the destination. replace_public_snapshot is the
  // only secondary operation in HAOne's integration contract.
  return json({ configured: isPublicPortalConfigured() });
};

export const PUT: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticatePortalAdmin(request);
  if (auth.error) return auth.error;

  try {
    const period = await validateActiveTerm(request);
    const { snapshot: _snapshot, ...preview } = await buildPublicSnapshotPreview(request, period);
    return json(preview);
  } catch (error: any) {
    if (error?.message === activeTermError) {
      return json({ error: activeTermError }, { status: 400 });
    }
    console.error("Public snapshot preview failed:", error);
    return json({ error: "Could not build the public snapshot preview" }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  if (!isPortalFeatureEnabled())
    return json({ error: "Portal feature is disabled" }, { status: 404 });
  const auth = await authenticatePortalAdmin(request);
  if (auth.error) return auth.error;

  if (!isPublicPortalConfigured()) {
    return json({ error: "Public portal destination is not configured" }, { status: 503 });
  }

  try {
    const period = await validateActiveTerm(request);
    return json({ success: true, ...(await syncPublicSnapshot(request, period)) });
  } catch (error: any) {
    if (error?.message === activeTermError) {
      return json({ error: activeTermError }, { status: 400 });
    }
    console.error("Public snapshot synchronization failed:", error);
    return json({ error: "Public snapshot synchronization failed" }, { status: 500 });
  }
};
