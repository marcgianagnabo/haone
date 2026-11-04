import { env } from "$env/dynamic/private";
import { createClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";

export class PortalHomepageError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type PortalHomeContent = {
  id: number;
  hero_image_id: string | null;
  hero_heading: string;
  hero_subheading: string;
};

const required = (name: string) => {
  const value = env[name];
  if (!value) throw new PortalHomepageError("Portal homepage management is not configured", 503);
  return value;
};

export function portalHomepageConfig() {
  const maxImageBytes = Number(env.PORTAL_MAX_HERO_IMAGE_BYTES) || 5 * 1024 * 1024;
  return {
    configured: Boolean(
      env.SECONDARY_SUPABASE_URL &&
      env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY &&
      env.PORTAL_FIREBASE_PROJECT_ID &&
      env.PORTAL_FIREBASE_SERVICE_ACCOUNT_JSON &&
      env.PORTAL_FIRESTORE_PORTAL_ASSET_COLLECTION
    ),
    maxImageBytes
  };
}

function database() {
  return createClient(
    required("SECONDARY_SUPABASE_URL"),
    required("SECONDARY_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false }
    }
  );
}

async function googleAccessToken() {
  const account = JSON.parse(required("PORTAL_FIREBASE_SERVICE_ACCOUNT_JSON"));
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" })
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
  if (!response.ok) throw new Error("Could not authenticate portal image storage");
  return (await response.json()).access_token as string;
}

function documentUrl(id: string) {
  const project = encodeURIComponent(required("PORTAL_FIREBASE_PROJECT_ID"));
  const collection = encodeURIComponent(required("PORTAL_FIRESTORE_PORTAL_ASSET_COLLECTION"));
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
}

async function saveImage(file: File) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const config = portalHomepageConfig();
  if (!allowed.includes(file.type)) throw new PortalHomepageError("Use a JPEG, PNG, or WebP image");
  if (!file.size || file.size > config.maxImageBytes) {
    throw new PortalHomepageError(
      `Image must be ${Math.floor(config.maxImageBytes / 1024 / 1024)} MB or smaller`
    );
  }
  const id = crypto.randomUUID();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const dataUri = `data:${file.type};base64,${btoa(binary)}`;
  const response = await fetch(documentUrl(id), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${await googleAccessToken()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        data: { stringValue: dataUri },
        contentType: { stringValue: file.type },
        createdAt: { timestampValue: new Date().toISOString() }
      }
    })
  });
  if (!response.ok) throw new Error("Could not store portal hero image");
  return { id, dataUri };
}

async function deleteImage(id: string) {
  if (!id) return;
  const response = await fetch(documentUrl(id), {
    method: "DELETE",
    headers: { authorization: `Bearer ${await googleAccessToken()}` }
  });
  if (!response.ok && response.status !== 404)
    throw new Error("Could not remove old portal hero image");
}

async function loadImage(id: string) {
  if (!id) return null;
  const response = await fetch(documentUrl(id), {
    headers: { authorization: `Bearer ${await googleAccessToken()}` }
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Could not load portal hero image");
  const document = await response.json();
  return (document.fields?.data?.stringValue as string) || null;
}

export async function getPortalHomepage() {
  if (!portalHomepageConfig().configured)
    throw new PortalHomepageError("Portal homepage management is not configured", 503);
  const { data, error } = await database()
    .from("home_content")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const content = (data ?? {
    id: 1,
    hero_image_id: null,
    hero_heading: "New Forestry Residence Hall Association",
    hero_subheading: "A home rooted in service, community, and shared responsibility."
  }) as PortalHomeContent;
  return {
    content,
    heroPreviewDataUri: content.hero_image_id ? await loadImage(content.hero_image_id) : null
  };
}

export async function updatePortalHomepage(input: {
  heading: string;
  subheading: string;
  removeImage: boolean;
  image?: File;
}) {
  const heading = input.heading.trim();
  const subheading = input.subheading.trim();
  if (!heading || heading.length > 200)
    throw new PortalHomepageError("Enter a heading up to 200 characters");
  if (subheading.length > 600)
    throw new PortalHomepageError("Subheading must be 600 characters or fewer");

  const current = await getPortalHomepage();
  let uploaded: { id: string; dataUri: string } | null = null;
  if (input.image) uploaded = await saveImage(input.image);
  const nextImageId = uploaded?.id ?? (input.removeImage ? null : current.content.hero_image_id);

  const { data, error } = await database()
    .from("home_content")
    .update({ hero_heading: heading, hero_subheading: subheading, hero_image_id: nextImageId })
    .eq("id", 1)
    .select("*")
    .single();
  if (error) {
    if (uploaded) await deleteImage(uploaded.id).catch(() => undefined);
    throw error;
  }

  if (current.content.hero_image_id && current.content.hero_image_id !== nextImageId) {
    await deleteImage(current.content.hero_image_id).catch((cleanupError) =>
      console.error("Could not remove replaced portal hero image:", cleanupError)
    );
  }
  return {
    content: data as PortalHomeContent,
    heroPreviewDataUri: uploaded?.dataUri ?? (nextImageId ? current.heroPreviewDataUri : null)
  };
}
