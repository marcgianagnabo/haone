import { env } from "$env/dynamic/private";
import { createClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";

export const PUBLICATION_STATUSES = ["draft", "published", "archived"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface PortalPublication {
  id: string;
  slug: string;
  title: string;
  memo_number: string;
  document_type: string;
  description: string;
  published_at: string;
  drive_file_id: string;
  drive_view_url: string;
  drive_download_url: string;
  preview_image_id: string;
  status: PublicationStatus;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export type PublicationInput = {
  title: string;
  memoNumber: string;
  documentType: string;
  description: string;
  publishedAt: string;
  status: PublicationStatus;
  isFeatured: boolean;
};

export class PortalCmsError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "PortalCmsError";
  }
}

const clean = (value: unknown) => String(value ?? "").trim();
const envNumber = (name: string, fallback: number) => {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

function requiredEnv(name: string) {
  const value = env[name];
  if (!value) throw new Error(`Missing portal server configuration: ${name}`);
  return value;
}

export function portalPublicationConfig() {
  const databaseConfigured = Boolean(
    env.SECONDARY_SUPABASE_URL && env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY
  );
  const uploadConfigured = Boolean(
    env.PORTAL_GOOGLE_SERVICE_ACCOUNT_JSON &&
    env.PORTAL_GOOGLE_SHARED_DRIVE_ID &&
    env.PORTAL_GOOGLE_PUBLICATIONS_FOLDER_ID
  );
  const previewConfigured = Boolean(
    env.PORTAL_FIREBASE_PROJECT_ID &&
    env.PORTAL_FIREBASE_SERVICE_ACCOUNT_JSON &&
    env.PORTAL_FIRESTORE_PUBLICATION_COLLECTION
  );
  return {
    configured: databaseConfigured && uploadConfigured,
    databaseConfigured,
    uploadConfigured,
    previewConfigured,
    maxPdfBytes: envNumber("PORTAL_MAX_PDF_BYTES", 20 * 1024 * 1024),
    maxPreviewBytes: envNumber("PORTAL_MAX_PREVIEW_BYTES", 300 * 1024)
  };
}

function assertDatabaseConfigured() {
  if (!portalPublicationConfig().databaseConfigured)
    throw new PortalCmsError("Portal database is not configured", 503);
}

function assertUploadConfigured() {
  if (!portalPublicationConfig().uploadConfigured)
    throw new PortalCmsError("Portal Shared Drive upload is not configured", 503);
}

function assertPreviewConfigured() {
  if (!portalPublicationConfig().previewConfigured)
    throw new PortalCmsError("Portal preview storage is not configured", 503);
}

function portalClient() {
  assertDatabaseConfigured();
  return createClient(env.SECONDARY_SUPABASE_URL, env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

async function googleAccessToken(serviceAccountJson: string, scopes: string[]) {
  let account: { private_key?: string; client_email?: string };
  try {
    account = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("Invalid Google service account configuration");
  }
  if (!account.private_key || !account.client_email) {
    throw new Error("Incomplete Google service account configuration");
  }

  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) throw new Error("Could not authenticate portal service account");
  const result = await response.json();
  if (!result.access_token) throw new Error("Portal service account returned no access token");
  return result.access_token as string;
}

function titleSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
}

function validateInput(value: Partial<PublicationInput>): PublicationInput {
  const title = clean(value.title);
  const memoNumber = clean(value.memoNumber);
  const documentType = clean(value.documentType) || "Other";
  const description = clean(value.description);
  const publishedAt = clean(value.publishedAt);
  const status = clean(value.status).toLowerCase() as PublicationStatus;

  if (!title || title.length > 200) throw new PortalCmsError("Enter a title up to 200 characters");
  if (!titleSlug(title)) throw new PortalCmsError("The title cannot produce a valid public URL");
  if (!memoNumber || memoNumber.length > 100) {
    throw new PortalCmsError("Enter a memo or reference number up to 100 characters");
  }
  if (documentType.length > 80) throw new PortalCmsError("Document type is too long");
  if (description.length > 4000) throw new PortalCmsError("Description is too long");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    throw new PortalCmsError("Enter a valid publication date");
  }
  if (!PUBLICATION_STATUSES.includes(status))
    throw new PortalCmsError("Invalid publication status");

  return {
    title,
    memoNumber,
    documentType,
    description,
    publishedAt,
    status,
    isFeatured: status === "published" && Boolean(value.isFeatured)
  };
}

function validatePdf(file: File) {
  const maxBytes = portalPublicationConfig().maxPdfBytes;
  if (!(file instanceof File) || file.size === 0) throw new PortalCmsError("Select a PDF file");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new PortalCmsError("Only PDF documents can be uploaded");
  }
  if (file.size > maxBytes) {
    throw new PortalCmsError(`PDF must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`);
  }
}

async function assertUniqueSlug(slug: string, excludeId?: string) {
  const { data, error } = await portalClient().from("publications").select("id,title,slug");
  if (error) throw error;
  const duplicate = (data ?? []).some(
    (publication) =>
      publication.id !== excludeId &&
      (publication.slug === slug || titleSlug(publication.title) === slug)
  );
  if (duplicate) throw new PortalCmsError("A publication with this title already exists", 409);
}

async function clearFeaturedPublications(excludeId?: string) {
  let query = portalClient()
    .from("publications")
    .update({ is_featured: false })
    .eq("is_featured", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { error } = await query;
  if (error) throw error;
}

async function uploadDrivePdf(file: File, slug: string) {
  const token = await googleAccessToken(requiredEnv("PORTAL_GOOGLE_SERVICE_ACCOUNT_JSON"), [
    "https://www.googleapis.com/auth/drive"
  ]);
  const folderId = requiredEnv("PORTAL_GOOGLE_PUBLICATIONS_FOLDER_ID");
  const folderResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=driveId,mimeType,trashed`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  if (!folderResponse.ok) throw new Error("Could not access Publications Shared Drive folder");
  const folder = await folderResponse.json();
  if (
    folder.trashed ||
    folder.mimeType !== "application/vnd.google-apps.folder" ||
    folder.driveId !== requiredEnv("PORTAL_GOOGLE_SHARED_DRIVE_ID")
  ) {
    throw new Error(
      "Configured Publications folder does not belong to the configured Shared Drive"
    );
  }
  const boundary = `haone_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = JSON.stringify({
    name: `${slug}.pdf`,
    mimeType: "application/pdf",
    parents: [folderId]
  });
  const prefix = new TextEncoder().encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`
  );
  const suffix = new TextEncoder().encode(`\r\n--${boundary}--`);
  const bytes = new Uint8Array(prefix.length + file.size + suffix.length);
  bytes.set(prefix, 0);
  bytes.set(new Uint8Array(await file.arrayBuffer()), prefix.length);
  bytes.set(suffix, prefix.length + file.size);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": `multipart/related; boundary=${boundary}`
      },
      body: bytes
    }
  );
  if (!response.ok) throw new Error("Could not upload PDF to Shared Drive");
  const result = await response.json();
  if (!result.id) throw new Error("Shared Drive returned no file ID");

  const permission = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.id)}/permissions?supportsAllDrives=true`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" })
    }
  );
  if (!permission.ok) {
    await deleteDriveFile(result.id).catch(() => undefined);
    throw new Error("Could not make the uploaded PDF publicly readable");
  }

  return {
    id: result.id as string,
    viewUrl: `https://drive.google.com/file/d/${result.id}/view`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${result.id}`
  };
}

async function deleteDriveFile(fileId: string) {
  if (!fileId) return;
  const token = await googleAccessToken(requiredEnv("PORTAL_GOOGLE_SERVICE_ACCOUNT_JSON"), [
    "https://www.googleapis.com/auth/drive"
  ]);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: "DELETE", headers: { authorization: `Bearer ${token}` } }
  );
  if (!response.ok && response.status !== 404) throw new Error("Could not delete Shared Drive PDF");
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function thumbnailAtSize(thumbnailLink: string, size: number) {
  if (/=s\d+[^/]*$/.test(thumbnailLink)) return thumbnailLink.replace(/=s\d+[^/]*$/, `=s${size}`);
  return `${thumbnailLink}${thumbnailLink.includes("?") ? "&" : "?"}sz=w${size}`;
}

async function fetchDriveThumbnail(fileId: string) {
  const token = await googleAccessToken(requiredEnv("PORTAL_GOOGLE_SERVICE_ACCOUNT_JSON"), [
    "https://www.googleapis.com/auth/drive.readonly"
  ]);
  let thumbnailLink = "";

  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=thumbnailLink`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    if (!response.ok) throw new Error("Could not inspect Shared Drive PDF");
    thumbnailLink = clean((await response.json()).thumbnailLink);
    if (thumbnailLink) break;
    await wait(1500);
  }
  if (!thumbnailLink) throw new Error("Shared Drive preview is not ready yet");

  const maxBytes = portalPublicationConfig().maxPreviewBytes;
  for (const size of [1200, 1000, 800, 600, 400, 300]) {
    const response = await fetch(thumbnailAtSize(thumbnailLink, size), {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= maxBytes) {
      return { bytes, contentType: response.headers.get("content-type") || "image/jpeg" };
    }
  }
  throw new Error("Drive preview could not be reduced to the configured size limit");
}

async function firestoreToken() {
  return googleAccessToken(requiredEnv("PORTAL_FIREBASE_SERVICE_ACCOUNT_JSON"), [
    "https://www.googleapis.com/auth/datastore"
  ]);
}

async function saveFirestorePreview(bytes: Uint8Array, contentType: string) {
  assertPreviewConfigured();
  const id = crypto.randomUUID();
  const token = await firestoreToken();
  const collection = encodeURIComponent(requiredEnv("PORTAL_FIRESTORE_PUBLICATION_COLLECTION"));
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(requiredEnv("PORTAL_FIREBASE_PROJECT_ID"))}/databases/(default)/documents/${collection}/${id}`;
  const dataUri = `data:${contentType};base64,${uint8ToBase64(bytes)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      fields: {
        data: { stringValue: dataUri },
        contentType: { stringValue: contentType },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  if (!response.ok) throw new Error("Could not save publication preview");
  return id;
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function deleteFirestorePreview(id: string) {
  if (!id) return;
  assertPreviewConfigured();
  const token = await firestoreToken();
  const collection = encodeURIComponent(requiredEnv("PORTAL_FIRESTORE_PUBLICATION_COLLECTION"));
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(requiredEnv("PORTAL_FIREBASE_PROJECT_ID"))}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: { authorization: `Bearer ${token}` } }
  );
  if (!response.ok && response.status !== 404)
    throw new Error("Could not delete publication preview");
}

async function generateAndAttachPreview(publication: PortalPublication) {
  assertPreviewConfigured();
  const thumbnail = await fetchDriveThumbnail(publication.drive_file_id);
  const newPreviewId = await saveFirestorePreview(thumbnail.bytes, thumbnail.contentType);
  const { error } = await portalClient()
    .from("publications")
    .update({ preview_image_id: newPreviewId, updated_at: new Date().toISOString() })
    .eq("id", publication.id);
  if (error) {
    await deleteFirestorePreview(newPreviewId).catch(() => undefined);
    throw error;
  }
  if (publication.preview_image_id) {
    await deleteFirestorePreview(publication.preview_image_id).catch((error) =>
      console.error("Could not remove replaced portal preview:", error)
    );
  }
  return newPreviewId;
}

async function getPublication(id: string): Promise<PortalPublication> {
  const { data, error } = await portalClient()
    .from("publications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new PortalCmsError("Publication not found", 404);
  return data as PortalPublication;
}

export async function listPublications() {
  assertDatabaseConfigured();
  const { data, error } = await portalClient()
    .from("publications")
    .select("*")
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PortalPublication[];
}

export async function createPublication(inputValue: Partial<PublicationInput>, file: File) {
  assertDatabaseConfigured();
  assertUploadConfigured();
  const input = validateInput(inputValue);
  validatePdf(file);
  const slug = titleSlug(input.title);
  await assertUniqueSlug(slug);

  const drive = await uploadDrivePdf(file, slug);
  let publication: PortalPublication | null = null;
  try {
    const { data, error } = await portalClient()
      .from("publications")
      .insert({
        slug,
        title: input.title,
        memo_number: input.memoNumber,
        document_type: input.documentType,
        description: input.description,
        published_at: input.publishedAt,
        drive_file_id: drive.id,
        drive_view_url: drive.viewUrl,
        drive_download_url: drive.downloadUrl,
        preview_image_id: "",
        status: input.status,
        is_featured: false
      })
      .select("*")
      .single();
    if (error) throw error;
    publication = data as PortalPublication;
    if (input.isFeatured) {
      await clearFeaturedPublications(publication.id);
      const { data: featured, error: featureError } = await portalClient()
        .from("publications")
        .update({ is_featured: true })
        .eq("id", publication.id)
        .select("*")
        .single();
      if (featureError) throw featureError;
      publication = featured as PortalPublication;
    }
  } catch (error) {
    if (publication?.id) {
      await portalClient().from("publications").delete().eq("id", publication.id);
    }
    await deleteDriveFile(drive.id).catch((cleanupError) =>
      console.error("Could not remove orphaned Drive upload:", cleanupError)
    );
    throw error;
  }

  if (!publication) throw new Error("Publication creation returned no record");

  const warnings: string[] = [];
  try {
    publication.preview_image_id = await generateAndAttachPreview(publication);
  } catch (error) {
    console.error("Publication preview generation failed:", error);
    warnings.push(
      "The PDF was uploaded, but its preview is not ready. Use Regenerate preview later."
    );
  }
  return { publication, warnings };
}

export async function updatePublication(id: string, value: Partial<PublicationInput>) {
  const current = await getPublication(id);
  const input = validateInput(value);
  const currentTitleSlug = titleSlug(input.title);
  await assertUniqueSlug(currentTitleSlug, id);
  if (input.isFeatured) await clearFeaturedPublications(current.id);

  const { data, error } = await portalClient()
    .from("publications")
    .update({
      // Keep the original database slug as a legacy alias. The public portal
      // derives the current canonical title-only slug and redirects this alias.
      slug: current.slug,
      title: input.title,
      memo_number: input.memoNumber,
      document_type: input.documentType,
      description: input.description,
      published_at: input.publishedAt,
      status: input.status,
      is_featured: input.isFeatured,
      updated_at: new Date().toISOString()
    })
    .eq("id", current.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as PortalPublication;
}

export async function regeneratePublicationPreview(id: string) {
  const publication = await getPublication(id);
  const previewImageId = await generateAndAttachPreview(publication);
  return { previewImageId };
}

export async function permanentlyDeletePublication(id: string) {
  const publication = await getPublication(id);
  const cleanup = { database: false, drive: false, preview: !publication.preview_image_id };
  const warnings: string[] = [];

  const { error } = await portalClient().from("publications").delete().eq("id", id);
  if (error) throw error;
  cleanup.database = true;

  try {
    await deleteDriveFile(publication.drive_file_id);
    cleanup.drive = true;
  } catch (error) {
    console.error("Publication Drive cleanup failed:", error);
    warnings.push("The publication record was deleted, but its Drive PDF could not be removed.");
  }

  if (publication.preview_image_id) {
    try {
      await deleteFirestorePreview(publication.preview_image_id);
      cleanup.preview = true;
    } catch (error) {
      console.error("Publication preview cleanup failed:", error);
      warnings.push(
        "The publication record was deleted, but its preview image could not be removed."
      );
    }
  }

  return { success: warnings.length === 0, cleanup, warnings };
}
