import { createCredentialJwt, getSheetsClient } from "$api/services/auth-service";
import { fetchSheetsData } from "$api/services/server-sheets-service";
import { env as privateEnv } from "$env/dynamic/private";
import { GI_CLIENT_SECRET, INSTANCE_ADMIN } from "$env/static/private";
import {
  PUBLIC_DB_PROVIDER,
  PUBLIC_GI_CLIENT_ID,
  PUBLIC_GS_RR_ID,
  PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  PUBLIC_SUPABASE_URL
} from "$env/static/public";
import type {
  GoogleAuthToken,
  GoogleUserInfo,
  TokenExchangeResponse,
  UserRecord
} from "$lib/types";
import { OFFICER_COL, USER_COL, UserTag } from "$lib/types";
import { createClient } from "@supabase/supabase-js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const URL_TOKEN_EXCHANGE = "https://oauth2.googleapis.com/token";
const URL_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

function getHighResPictureUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  return url.replace(/([=|\/])s\d+(-[c|p|o|g])?(\/|$)/, "$1s384-c$3");
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { code, code_verifier, redirect_uri } = await request.json();

    // Exchange authorization code for refresh and access tokens.
    const tokenResponse = await fetch(URL_TOKEN_EXCHANGE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: PUBLIC_GI_CLIENT_ID,
        client_secret: GI_CLIENT_SECRET,
        code,
        code_verifier,
        grant_type: "authorization_code",
        redirect_uri
      })
    });

    const tokenData: GoogleAuthToken = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return json(tokenData, { status: tokenResponse.status });
    }

    // Fetch user profile info from Google.
    const userInfoResponse = await fetch(URL_USERINFO, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userInfoResponse.ok) {
      return json({ error_description: "Failed to fetch profile info" }, { status: 500 });
    }

    const userInfoData: GoogleUserInfo = await userInfoResponse.json();
    const email = userInfoData.email.trim().toLowerCase();
    const isInstanceAdmin = email === (INSTANCE_ADMIN || "").trim().toLowerCase();

    let user: UserRecord | null = null;
    try {
      const result = await lookupUser(email);
      user = result.user;

      // Enforce domain check
      if (!isInstanceAdmin && !email.endsWith("@up.edu.ph") && result.isStudent) {
        return json(
          {
            error: "forbidden_domain",
            error_description: "Only @up.edu.ph emails allowed for students."
          },
          { status: 403 }
        );
      }
    } catch (e: any) {
      console.error("User lookup in token endpoint failed:", e);
      return json(
        {
          error: "server_error",
          error_description: e.message || "User lookup in token endpoint failed."
        },
        { status: 500 }
      );
    }

    // Build a dummy user record since the signed-in user does not yet exist
    // in the database. This allows the user to proceed to the app and create
    // their account. The user will be prompted to fill in the missing details
    // during the onboarding process.
    const isNewUser = !user;
    if (!user) {
      user = {
        email,
        lastName: (userInfoData.family_name || "").trim().toUpperCase(),
        firstName: (userInfoData.given_name || "").trim().toUpperCase(),
        middleName: "",
        suffix: "",
        overrideName: "",
        displayName:
          userInfoData.family_name && userInfoData.given_name
            ? `${userInfoData.family_name.trim().toUpperCase()}, ${userInfoData.given_name.trim().toUpperCase()}`
            : (userInfoData.name || "").trim(),
        displayNameFormal: (userInfoData.name || "").trim(),
        studentNo: "",
        secondaryContact: "",
        college: "",
        program: "",
        id: crypto.randomUUID()
      };
    }

    // Normalize user photo URL to high resolution. Fill-once: an existing
    // stored photo always wins over a newer Gmail photo; only users without
    // a stored photo adopt (and persist) the current Gmail photo.
    const gmailPhoto = getHighResPictureUrl(userInfoData.picture);
    if (isNewUser) {
      user.avatarUrl = gmailPhoto;
    } else if ((user.avatarUrl || "").trim()) {
      // Keep the stored photo; ignore the live Gmail photo.
    } else {
      user.avatarUrl = gmailPhoto;
      if (gmailPhoto && PUBLIC_DB_PROVIDER === "supabase") {
        try {
          await persistSupabaseAvatarFillOnce(email, gmailPhoto);
        } catch (e: any) {
          console.error("Avatar auto-fill failed:", e?.message || e);
        }
      }
    }

    // Best-effort: persist the Gmail photo for the officer directory (Sheets
    // backend). Fills users col Q and directory col L (auto photo) only — the
    // admin-managed override in col K always wins. Supabase is covered
    // client-side after sign-in (officer session satisfies RLS).
    if (user.avatarUrl && PUBLIC_DB_PROVIDER !== "supabase") {
      try {
        await persistSheetsOfficerPhoto(email, user.avatarUrl);
      } catch (e: any) {
        console.error("Officer photo auto-fill failed:", e?.message || e);
      }
    }

    // Best-effort: seed the INSTANCE_ADMIN_EMAIL constant so the extended
    // is_officer() grants the instance admin officer privilege by default.
    // No officers row is created — elected positions are untouched.
    if (isInstanceAdmin && PUBLIC_DB_PROVIDER === "supabase") {
      try {
        await seedInstanceAdminConstant(email);
      } catch (e: any) {
        console.error("Instance admin seed failed:", e?.message || e);
      }
    }

    let credentialJwt = "";
    try {
      credentialJwt = await createCredentialJwt({
        email,
        sub: user.id,
        isInstanceAdmin
      });
    } catch (jwtErr: any) {
      console.error("Failed to generate credential JWT:", jwtErr);
      return json(
        {
          error: "server_error",
          error_description: "Failed to generate credential token"
        },
        { status: 500 }
      );
    }

    return json({
      tokenData,
      user,
      isInstanceAdmin,
      credentialJwt
    } satisfies TokenExchangeResponse);
  } catch (e: any) {
    console.error(e);
    return json({ error: "server_error", error_description: e.message }, { status: 500 });
  }
};

async function lookupUserSupabase(
  email: string
): Promise<{ user: UserRecord | null; isStudent: boolean }> {
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const { data: dbUser } = await supabase
    .from("users")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (dbUser) {
    const tags = Array.isArray(dbUser.tags) ? dbUser.tags : [];
    const user: UserRecord = {
        id: dbUser.id,
        email: dbUser.email,
        lastName: dbUser.last_name || "",
        firstName: dbUser.first_name || "",
        middleName: dbUser.middle_name || "",
        suffix: dbUser.suffix || "",
        overrideName: dbUser.override_name || "",
        displayName: dbUser.display_name || "",
        displayNameFormal: dbUser.display_name_fl || "",
        studentNo: dbUser.student_no || "",
        secondaryContact: dbUser.secondary_contact || "",
        college: dbUser.college || "",
        program: dbUser.degree_program || "",
        avatarUrl: dbUser.avatar_url || ""
      };
    return {
      user,
      isStudent: tags.includes(UserTag.STUDENT)
    };
  }

  return { user: null, isStudent: false };
}

async function lookupUserSheets(
  email: string
): Promise<{ user: UserRecord | null; isStudent: boolean }> {
  const saClient = await getSheetsClient();
  const [userRows] = await fetchSheetsData(saClient, ["users!A:P"]);
  const row = userRows.find((r: any) => {
    return (r[USER_COL.EMAIL] || "").toLowerCase() === email;
  });

  if (row) {
    const tagsStr = (row[USER_COL.TAGS] || "").trim().toUpperCase();
    const tags = tagsStr.split(":").map((t: string) => t.trim());
    const user: UserRecord = {
      email: (row[USER_COL.EMAIL] || "").trim(),
      lastName: (row[USER_COL.LAST_NAME] || "").trim(),
      firstName: (row[USER_COL.FIRST_NAME] || "").trim(),
      middleName: (row[USER_COL.MIDDLE_NAME] || "").trim(),
      suffix: (row[USER_COL.SUFFIX] || "").trim(),
      overrideName: (row[USER_COL.OVERRIDE_NAME] || "").trim(),
      displayName: (row[USER_COL.DISPLAY_NAME] || "").trim(),
      displayNameFormal: (row[USER_COL.DISPLAY_NAME_FL] || "").trim(),
      studentNo: (row[USER_COL.STUDENT_NO] || "").trim(),
      secondaryContact: (row[USER_COL.SECONDARY_CONTACT] || "").trim(),
      college: (row[USER_COL.COLLEGE] || "").trim(),
      program: (row[USER_COL.DEGREE_PROGRAM] || "").trim(),
      id: (row[USER_COL.ID] || "").trim()
    };
    return {
      user,
      isStudent: tags.includes(UserTag.STUDENT)
    };
  }

  return { user: null, isStudent: false };
}

async function lookupUser(email: string): Promise<{ user: UserRecord | null; isStudent: boolean }> {
  switch (PUBLIC_DB_PROVIDER) {
    case "supabase": {
      return await lookupUserSupabase(email);
    }
    case "sheets":
    default: {
      return await lookupUserSheets(email);
    }
  }
}

async function persistSupabaseAvatarFillOnce(email: string, photoUrl: string): Promise<void> {
  const serviceKey = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return;
  }
  const admin = createClient(PUBLIC_SUPABASE_URL, serviceKey);
  // Fill-once: only rows without a stored photo adopt the Gmail photo, so a
  // newer Gmail picture never overwrites the stored one.
  const { data: existing, error: readError } = await admin
    .from("users")
    .select("id, avatar_url")
    .ilike("email", email)
    .maybeSingle();
  if (readError) {
    throw readError;
  }
  if (existing && !((existing.avatar_url || "") as string).trim()) {
    const { error } = await admin
      .from("users")
      .update({ avatar_url: photoUrl })
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
  }
}

async function seedInstanceAdminConstant(email: string): Promise<void> {
  const serviceKey = privateEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return;
  }
  const admin = createClient(PUBLIC_SUPABASE_URL, serviceKey);
  const { error } = await admin.from("constants").upsert(
    {
      key: "INSTANCE_ADMIN_EMAIL",
      value: email.trim().toLowerCase(),
      description: "Instance admin: officer privilege by default (see is_officer)"
    },
    { onConflict: "key" }
  );
  if (error) {
    throw error;
  }
}

async function persistSheetsOfficerPhoto(email: string, photoUrl: string): Promise<void> {
  if (!PUBLIC_GS_RR_ID) {
    return;
  }
  const { getSheetsClient } = await import("$api/services/auth-service");
  const { getSheetValues, updateSheetValue } = await import(
    "$api/services/server-sheets-service"
  );
  const saClient = await getSheetsClient();
  const [userRows, dirRows] = await Promise.all([
    getSheetValues(saClient, PUBLIC_GS_RR_ID, "users!A:Q"),
    getSheetValues(saClient, PUBLIC_GS_RR_ID, "directory!A:L")
  ]);

  const userIndex = userRows.findIndex(
    (r: any) => (r[USER_COL.EMAIL] || "").toLowerCase().trim() === email
  );
  if (userIndex > 0 && (userRows[userIndex][USER_COL.AVATAR_URL] || "") !== photoUrl) {
    await updateSheetValue(saClient, PUBLIC_GS_RR_ID, `users!Q${userIndex + 1}`, [[photoUrl]]);
  }

  for (let i = 1; i < dirRows.length; i++) {
    const row = dirRows[i];
    if ((row[OFFICER_COL.EMAIL] || "").toLowerCase().trim() !== email) {
      continue;
    }
    if ((row[OFFICER_COL.PHOTO_AUTO] || "") === photoUrl) {
      continue;
    }
    await updateSheetValue(saClient, PUBLIC_GS_RR_ID, `directory!L${i + 1}`, [[photoUrl]]);
  }
}
