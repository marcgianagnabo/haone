import { fetchSheetsData } from "$api/services/server-sheets-service";
import { GOOGLE_SERVICE_ACCOUNT_JSON, JWT_SECRET } from "$env/static/private";
import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import type { CredentialPayload } from "$lib/types";
import { ACCOUNT_COL, OFFICER_COL, OfficerStatus } from "$lib/types";
import { json } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { base64url, jwtVerify, SignJWT } from "jose";

/**
 * Signs a payload using RS256 with a private key.
 */
export async function sign(input: string, pem: string): Promise<string> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.substring(
    pem.indexOf(pemHeader) + pemHeader.length,
    pem.indexOf(pemFooter)
  );
  const binaryKey = Uint8Array.from(atob(pemContents.replace(/\s/g, "")), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" }
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );

  return base64url.encode(new Uint8Array(signature));
}

/**
 * Generates a Google Access Token using a service account JWT.
 */
export async function getServiceAccountToken(email: string, privateKey: string, scopes: string[]) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url.encode(JSON.stringify(header));
  const encodedPayload = base64url.encode(JSON.stringify(payload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = await sign(input, privateKey);
  const jwt = `${input}.${signature}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

/**
 * Creates an authorized Google Sheets client (token) using the service account.
 */
export async function getSheetsClient() {
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/spreadsheets"
  ]);
  return token;
}

/**
 * Creates an authorized Firebase client (token) using the service account.
 */
export async function getFirebaseToken() {
  const keys = JSON.parse(GOOGLE_SERVICE_ACCOUNT_JSON);
  const token = await getServiceAccountToken(keys.client_email, keys.private_key, [
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase"
  ]);
  return token;
}

/**
 * Creates a signed credential JWT valid for 1 hour.
 */
export async function createCredentialJwt(payload: CredentialPayload): Promise<string> {
  const secretKey = new TextEncoder().encode(JWT_SECRET);

  return new SignJWT({
    email: payload.email,
    sub: payload.sub,
    isInstanceAdmin: payload.isInstanceAdmin
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secretKey);
}

/**
 * Verifies a signed credential JWT using jose. Returns null if invalid or expired.
 */
export async function verifyCredentialJwt(token: string): Promise<CredentialPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(JWT_SECRET);

    const { payload } = await jwtVerify<CredentialPayload>(token, secretKey, {
      algorithms: ["HS256"]
    });

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * Validates the incoming HTTP Authorization header Bearer token against our
 * HMAC-signed 1-hour session token using jose.
 *
 * Performs local cryptographic verification with zero external network calls.
 * Extracts authenticated session claims (`email`, `residentId`, `isInstanceAdmin`)
 * or returns a 401 Unauthorized JSON response on missing/invalid/expired token.
 */
export async function authenticateResident(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const token = authHeader.split(" ")[1];

  try {
    const session = await verifyCredentialJwt(token);
    if (!session) {
      return { error: json({ error: "Invalid or expired session token" }, { status: 401 }) };
    }

    return {
      email: session.email,
      residentId: session.sub,
      isInstanceAdmin: session.isInstanceAdmin
    };
  } catch (e: any) {
    console.error("Auth validation failed:", e);
    return {
      error: json({ error: "Authentication check failed", message: e.message }, { status: 500 })
    };
  }
}

/**
 * Standardized admin authentication for API routes.
 */
export async function authenticateAdmin(request: Request) {
  const auth = await authenticateResident(request);
  if (auth.error) {
    return auth;
  }

  // Instance admins are granted admin access without requiring an officership.
  if (auth.isInstanceAdmin) {
    return auth;
  }

  try {
    const isAdmin = await isOfficerEmail(auth.email);
    if (!isAdmin) {
      return {
        error: json({ error: "Forbidden: Admin access required (Officer only)" }, { status: 403 })
      };
    }

    return auth;
  } catch (e: any) {
    return {
      error: json({ error: "Admin check failed", message: e.message }, { status: 500 })
    };
  }
}

/**
 * Determines whether an email belongs to an active officer/admin.
 * Uses the `officers` table on Supabase and the `directory!A:H` sheet otherwise.
 */
async function isOfficerEmail(email?: string | null): Promise<boolean> {
  if (!email) {
    return false;
  }

  if (PUBLIC_DB_PROVIDER === "supabase") {
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await supabase
      .from("officers")
      .select("id")
      .ilike("email", email)
      .eq("status", OfficerStatus.ACTIVE)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return !!data;
  }

  const token = await getSheetsClient();
  const [directory] = await fetchSheetsData(token, ["directory!A:H"]);
  return directory.some(
    (r: any) => (r[OFFICER_COL.EMAIL] || "").toLowerCase() === email.toLowerCase()
  );
}

/**
 * Pure helper function to resolve resident account type from accounts sheet rows.
 */
export function resolveResidentAccountType(
  accRows: any[][],
  activeTerm: string,
  residentId: string
): string | null {
  const account = accRows.find((r: any) => {
    return (
      (r[ACCOUNT_COL.PERIOD] || "").trim() === activeTerm &&
      (r[ACCOUNT_COL.RESIDENT_ID] || "").trim() === residentId
    );
  });
  if (account) {
    const rawType = (account[ACCOUNT_COL.TYPE] || "").trim().toUpperCase();
    return rawType || null;
  }
  return null;
}

export const authService = {
  sign,
  getServiceAccountToken,
  getSheetsClient,
  getFirebaseToken,
  createCredentialJwt,
  verifyCredentialJwt,
  authenticateResident,
  authenticateAdmin,
  resolveResidentAccountType
};
