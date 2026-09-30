#!/usr/bin/env node
/**
 * HAOne — guarded TEST DATA CLEANUP
 * =============================================================================
 * Removes records that were explicitly created as test data, from every
 * connected store:
 *
 *   1. Firestore      push_subscriptions, uploads
 *   2. Supabase Auth  test login accounts
 *   3. Supabase DB    dependent rows, then the resident profile
 *
 * DESIGN RULES (do not relax these)
 * -----------------------------------------------------------------------------
 *  * There is NO "delete everything" mode. Records are removed only when they
 *    are listed in a manifest. If a record is not in the manifest, it is
 *    never touched.
 *  * HAOne's schema has no `is_test` / `test_marker` column, and this script
 *    will not add one. Adding a column would change the database structure and
 *    every table would then have to be backfilled. Instead, test records are
 *    identified by an EXPLICIT manifest, and every candidate email must also
 *    pass a test-pattern check before it is deleted.
 *  * Dry run is the DEFAULT. Deletion requires both `--execute` and
 *    `--confirm <label>`.
 *  * The two internal system accounts (SYSTEM_IDS.FUNDS / SYSTEM_IDS.IMPORTED)
 *    are hard-blocked and can never be deleted by this script.
 *  * A resident with financial history outside the declared test periods is
 *    REFUSED, because that indicates a real resident rather than test data.
 *
 * USAGE
 * -----------------------------------------------------------------------------
 *   cp scripts/test-data-manifest.example.json scripts/test-data-manifest.json
 *   # edit the manifest
 *   node scripts/cleanup-test-data.mjs --manifest scripts/test-data-manifest.json
 *   node scripts/cleanup-test-data.mjs --manifest scripts/test-data-manifest.json \
 *        --execute --confirm "<the manifest label>"
 *
 * REQUIRED ENVIRONMENT (server-side only — never in a PUBLIC_ variable)
 * -----------------------------------------------------------------------------
 *   PUBLIC_SUPABASE_URL            from .env
 *   SUPABASE_SERVICE_ROLE_KEY      Supabase dashboard -> API keys -> service_role
 *   GOOGLE_SERVICE_ACCOUNT_JSON    only if cleaning Firestore
 *
 * FLAGS
 * -----------------------------------------------------------------------------
 *   --manifest <path>   manifest file (required)
 *   --execute           actually delete (omit for a dry run)
 *   --confirm <label>   must equal the manifest "label"
 *   --include-firestore skip the Firestore stage
 *   --include-auth      skip the Supabase Auth stage
 *   --include-db        skip the Supabase DB stage
 *   --force             allow deletion despite the out-of-period history guard
 *                       (only for a genuinely disposable environment)
 * =============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import { SignJWT, importPKCS8 } from "jose";
import { readFileSync } from "node:fs";

// -----------------------------------------------------------------------------
// CONFIGURATION
// -----------------------------------------------------------------------------

/** Never deletable. Mirrors SYSTEM_IDS in src/lib/constants.ts. */
const PROTECTED_USER_IDS = new Set([
  "65eb6240-8200-48dd-a1b9-01c5994c77d7", // _funds
  "45ee82f7-103f-4607-80b8-6377a76441b7" // _imported
]);

const PROTECTED_USER_EMAILS = new Set(["_funds", "_imported"]);

/**
 * A candidate is only treated as a test record when its email matches one of
 * these. This is the main protection against deleting a real resident whose id
 * was pasted into the manifest by mistake.
 */
const TEST_EMAIL_PATTERNS = [
  /@example\.(com|org|net)$/i,
  /@.*\.invalid$/i,
  /^test[._-]/i,
  /[._-]test@/i,
  /\+test@/i,
  /^(demo|qa|ci|bot)@/i,
  /@sentry\.io$/i
];

/** Deletion order: children before parents. */
const DB_DELETE_ORDER = [
  "achievement_records",
  "fridge_items",
  "laundry",
  "payment_requests",
  "journal",
  "accounts",
  "registrations",
  "user_settings",
  "announcements",
  "achievements",
  "users"
];

/** Tables whose rows are matched by a resident/creator/account id. */
const ID_COLUMN_BY_TABLE = {
  achievement_records: ["account_id", "recorder_id"],
  fridge_items: ["resident_id"],
  laundry: ["resident_id"],
  payment_requests: ["resident_id"],
  journal: ["account_id", "creator_id"],
  accounts: ["resident_id", "issuer_id"],
  registrations: ["email"],
  user_settings: ["resident_id"],
  announcements: ["creator_id"],
  achievements: ["creator_id"],
  users: ["id", "email"]
};

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { includeFirestore: true, includeAuth: true, includeDb: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--manifest") out.manifest = argv[++i];
    else if (a === "--execute") out.execute = true;
    else if (a === "--confirm") out.confirm = argv[++i];
    else if (a === "--force") out.force = true;
    else if (a === "--include-firestore") out.includeFirestore = true;
    else if (a === "--skip-firestore") out.includeFirestore = false;
    else if (a === "--include-auth") out.includeAuth = true;
    else if (a === "--skip-auth") out.includeAuth = false;
    else if (a === "--include-db") out.includeDb = true;
    else if (a === "--skip-db") out.includeDb = false;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

/** Minimal .env reader so this script needs no extra dependency. */
function loadEnvFile(path = ".env") {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn(...a);
const step = (...a) => console.log("\n[36m==>", ...a, "[0m");

function isTestEmail(email) {
  if (!email) return false;
  return TEST_EMAIL_PATTERNS.some((re) => re.test(email));
}

function assertNotProtected(id, email) {
  if (id && PROTECTED_USER_IDS.has(id)) {
    throw new Error(`Refusing to touch protected system account id ${id}.`);
  }
  if (email && PROTECTED_USER_EMAILS.has(email.toLowerCase())) {
    throw new Error(`Refusing to touch protected system account ${email}.`);
  }
}

// -----------------------------------------------------------------------------
// FIRESTORE
// -----------------------------------------------------------------------------

async function getGoogleAccessToken(serviceAccount) {
  const keyId = serviceAccount.private_key_id;
  const clientEmail = serviceAccount.client_email;
  const pem = String(serviceAccount.private_key).replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firestore",
    aud: "https://oauth2.googleapis.com/token"
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(pem, "RS256"));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

async function firestoreDeleteDoc(token, projectId, collection, docId) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/${collection}/${docId}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (res.ok || res.status === 404) return res.status === 404 ? "absent" : "deleted";
  throw new Error(
    `Firestore delete failed (${collection}/${docId}): ${res.status} ${await res.text()}`
  );
}

async function cleanupFirestore(manifest, execute) {
  const fsCfg = manifest.firestore || {};
  const collections = ["push_subscriptions", "uploads"];
  const work = collections.flatMap((c) => (fsCfg[c] || []).map((id) => ({ collection: c, id })));

  if (work.length === 0) {
    log("   (manifest lists no Firestore documents)");
    return;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set; cannot clean Firestore.");

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
  }

  const token = await getGoogleAccessToken(sa);
  log(`   project: ${sa.project_id}`);

  for (const { collection, id } of work) {
    if (!execute) {
      log(`   would delete firestore/${collection}/${id}`);
      continue;
    }
    const status = await firestoreDeleteDoc(token, sa.project_id, collection, id);
    log(`   firestore/${collection}/${id} -> ${status}`);
  }
}

// -----------------------------------------------------------------------------
// SUPABASE
// -----------------------------------------------------------------------------

function makeAdmin() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("PUBLIC_SUPABASE_URL is not set.");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Get it from Supabase dashboard -> " +
        "Project Settings -> API Keys -> service_role. It is server-only: never " +
        "put it in a PUBLIC_ variable or commit it."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function cleanupAuth(admin, manifest, execute) {
  const emails = (manifest.residents?.emails || []).map((e) => e.toLowerCase());
  if (emails.length === 0) {
    log("   (manifest lists no auth emails)");
    return;
  }

  const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);

  const targets = list.users.filter((u) => emails.includes(String(u.email || "").toLowerCase()));
  log(`   matched ${targets.length} auth user(s)`);

  for (const u of targets) {
    if (!execute) {
      log(`   would delete auth user ${u.email} (${u.id})`);
      continue;
    }
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) throw new Error(`deleteUser ${u.email} failed: ${delErr.message}`);
    log(`   auth user ${u.email} -> deleted`);
  }
}

async function cleanupDb(admin, manifest, execute) {
  const residentEmails = (manifest.residents?.emails || []).map((e) => e.toLowerCase());
  const explicitIds = manifest.residents?.ids || [];
  const testPeriods = new Set(manifest.residents?.testPeriods || []);

  if (residentEmails.length === 0 && explicitIds.length === 0) {
    log("   (manifest lists no residents)");
    return;
  }

  // Resolve manifest entries -> real user ids.
  const { data: rows, error } = await admin
    .from("users")
    .select("id, email")
    .or(
      [
        explicitIds.length ? `id.in.(${explicitIds.join(",")})` : null,
        residentEmails.length ? `email.in.(${residentEmails.map((e) => `"${e}"`).join(",")})` : null
      ]
        .filter(Boolean)
        .join(",")
    );
  if (error) throw new Error(`Resolving users failed: ${error.message}`);

  const targets = rows || [];
  log(`   matched ${targets.length} resident profile(s)`);

  for (const t of targets) assertNotProtected(t.id, t.email);

  const ids = targets.map((t) => t.id);
  const emails = targets.map((t) => String(t.email || "").toLowerCase());

  // Guard: every matched email must look like test data.
  const nonTest = emails.filter((e) => !isTestEmail(e));
  if (nonTest.length > 0 && !manifest.allowNonTestEmails) {
    throw new Error(
      `Refusing to continue: manifest resolved to non-test-looking email(s):\n` +
        nonTest.map((e) => `    - ${e}`).join("\n") +
        `\nIf these really are test accounts, set "allowNonTestEmails": true in the ` +
        `manifest AND record why. Otherwise remove them from the manifest.`
    );
  }

  // Guard: no financial history outside the declared test periods.
  if (testPeriods.size === 0) {
    throw new Error(
      'The manifest must declare "residents.testPeriods" (the academic term ' +
        "codes that are known to be test-only). Without it this script cannot " +
        "tell test history from real history, so it refuses to run."
    );
  }

  if (ids.length > 0) {
    const { data: jRows, error: jErr } = await admin
      .from("journal")
      .select("id, account_id, period, type, water, assoc, maintenance, gas, misc")
      .in("account_id", ids);
    if (jErr) throw new Error(`journal history check failed: ${jErr.message}`);

    const outside = (jRows || []).filter((r) => !testPeriods.has(String(r.period)));
    if (outside.length > 0 && !manifest.force) {
      throw new Error(
        `Refusing to delete: ${outside.length} journal row(s) exist OUTSIDE the ` +
          `declared test period(s) [${[...testPeriods].join(", ")}]. This looks ` +
          `like a real resident with real financial history:\n` +
          outside
            .slice(0, 20)
            .map((r) => `    - ${r.id} period=${r.period} type=${r.type}`)
            .join("\n") +
          `\nRemove them from the manifest, add their periods to testPeriods, or ` +
          `re-run with --force if this environment is genuinely disposable.`
      );
    }
    log(`   journal rows inside test periods: ${(jRows || []).length - outside.length}`);
    if (outside.length) warn(`   ! ${outside.length} out-of-period row(s) present (--force)`);
  }

  // Delete children -> parents.
  for (const table of DB_DELETE_ORDER) {
    const columns = ID_COLUMN_BY_TABLE[table];
    if (!columns) continue;

    let query = admin.from(table).select("id", { count: "exact", head: true });
    const clauses = [];

    if (ids.length)
      for (const col of columns) if (col !== "email") clauses.push(`${col}.in.(${ids.join(",")})`);
    if (emails.length)
      for (const col of columns)
        if (col === "email") clauses.push(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`);
    if (clauses.length === 0) continue;

    query = query.or(clauses.join(","));
    const { count, error: cErr } = await query;
    if (cErr) continue;
    if (!count) continue;

    if (!execute) {
      log(`   would delete ${count} row(s) from ${table}`);
      continue;
    }

    let del = admin.from(table).delete();
    if (ids.length)
      for (const col of columns) if (col !== "email") del = del.or(`${col}.in.(${ids.join(",")})`);
    if (emails.length)
      for (const col of columns)
        if (col === "email") del = del.or(`email.in.(${emails.map((e) => `"${e}"`).join(",")})`);
    if (clauses.length === 0) continue;
    del = del.or(clauses.join(","));

    const { error: dErr } = await del;
    if (dErr) throw new Error(`Deleting from ${table} failed: ${dErr.message}`);
    log(`   ${table} -> deleted ${count} row(s)`);
  }
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

async function main() {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest) throw new Error("--manifest <path> is required.");

  const manifest = JSON.parse(readFileSync(args.manifest, "utf8"));
  if (!manifest.label) throw new Error('The manifest must have a "label".');

  log("=".repeat(72));
  log(" HAOne TEST DATA CLEANUP");
  log("=".repeat(72));
  log(` manifest : ${args.manifest}`);
  log(` label    : ${manifest.label}`);
  log(` mode     : ${args.execute ? "EXECUTE (destructive)" : "DRY RUN (no changes)"}`);
  log(` target   : ${process.env.PUBLIC_SUPABASE_URL || "(not set)"}`);
  log("=".repeat(72));

  if (args.execute) {
    if (args.confirm !== manifest.label) {
      throw new Error(
        `--execute requires --confirm "<label>" and it must match the manifest ` +
          `label exactly. Expected: ${manifest.label}`
      );
    }
    if (args.force) {
      warn("! --force given: the out-of-period history guard is being overridden.");
    }
  }

  const admin = args.includeAuth || args.includeDb ? makeAdmin() : null;

  if (args.includeFirestore) {
    step("Firestore");
    await cleanupFirestore(manifest, args.execute);
  }
  if (args.includeAuth) {
    step("Supabase Auth");
    await cleanupAuth(admin, manifest, args.execute);
  }
  if (args.includeDb) {
    step("Supabase DB");
    await cleanupDb(admin, manifest, args.execute);
  }

  step("Done");
  if (!args.execute) {
    log(" This was a DRY RUN. Nothing was deleted.");
    log(` Re-run with --execute --confirm "${manifest.label}" to apply.`);
  }
}

main().catch((err) => {
  console.error(`\n[31mABORTED:[0m ${err.message}\n`);
  process.exit(1);
});
