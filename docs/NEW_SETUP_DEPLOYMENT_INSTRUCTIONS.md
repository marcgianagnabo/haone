# HAOne — Setup & Deployment Instructions

Authoritative guide for installing, configuring, deploying and verifying HAOne.
Written against the current codebase. Follow it top to bottom on a new
installation.

> **Scope of this document**
> This guide covers a **fresh Supabase installation** and application setup.
> It deliberately does **not** hardcode any institution-specific or
> production-confidential value. Every such value (academic term codes, fee
> amounts, admin emails, workbook IDs, API keys) is a placeholder you must
> supply from your own records or secret manager.

---

## 0. What HAOne talks to

Before installing, understand the moving parts. HAOne is a SvelteKit app that
can run against **two** database backends and talks to a few external services.

| Concern                            | What is actually used                        | Required?                        |
| ---------------------------------- | -------------------------------------------- | -------------------------------- |
| Database / Auth / RLS              | **Supabase** (Postgres + Auth)               | Yes, in `supabase` mode          |
| Legacy database backend            | Google Sheets workbooks                      | Only in `sheets` mode            |
| Resident picture / upload storage  | **Firestore** (Google) via a service account | If you use uploads/receipts/push |
| Push notifications                 | Firestore `push_subscriptions` + VAPID keys  | Optional                         |
| Login identity                     | Google OAuth (and/or Supabase Auth email)    | Yes                              |
| Scheduled jobs (laundry reminders) | `/api/tasks/cron` + `CRON_SECRET`            | If you use reminders             |

**Important — what is NOT used:** HAOne does **not** use Firebase Authentication,
Firebase Storage, the Firebase client SDK, `firebase.json`, or Firebase security
rules. Firestore is accessed server-side with a Google _service account_ through
the REST API. Do not set up Firebase Auth or Firebase Storage for this project,
and do not look for a `firebase.json`, `firestore.rules`, or
`firestore.indexes.json` to configure — they are not part of this system.

### The `PUBLIC_DB_PROVIDER` switch

`PUBLIC_DB_PROVIDER` selects the backend and must match how you installed:

- `supabase` — the recommended, current path. This guide's database steps assume it.
- `sheets` — the legacy Google Sheets backend. Only choose this if you are
  deliberately maintaining an existing Sheets deployment. See §8.

Set it to match reality. A mismatch (for example `sheets` pointed at a Supabase
project) produces confusing empty-data errors.

---

## 1. Prerequisites

- Node.js 20+ and a package manager (this repo uses `npm` scripts; `pnpm` also works).
- A **Supabase** project (free tier is fine to start).
- A Google Cloud project **only if** you will use Firestore, VAPID push, or
  Google Sheets.
- A Google OAuth client if you want Google sign-in.
- Your institution's real values: academic term codes, fee amounts, at least one
  administrator email, and (if using Sheets) three workbook IDs.

---

## 2. Get the code and install

```bash
git clone <your-repo-url> haone
cd haone
npm install
```

Copy the environment template and edit it (Section 4):

```bash
cp .env.example .env
```

> On Windows PowerShell use `Copy-Item .env.example .env`.

---

## 3. Create the private configuration folder

`src-private/` holds institution-specific branding and is **git-ignored**. The
repo ships a template at `src-private-example/`.

```bash
cp -r src-private-example src-private
```

Then edit `src-private/`:

- `branding.json` — name, logo/colours for your hall. The `key` here must match
  `PUBLIC_BRANDING` in `.env`.
- `rooms.json` — your building/room layout used by reports and the room picker.
- `assets/letterhead*.{svg,png}` — letterhead on generated PDFs.
- `services.ts` — optional custom service entries (safe to leave as `[]`).

> Never commit `src-private/`. It is ignored on purpose.

---

## 4. Configure the environment (`.env`)

Fill this in from `.env.example`. Values marked **(secret)** must never be
committed or pasted into tickets/logs. A production `.env` is git-ignored.

### Application

- `PUBLIC_APP_ENV` — `production` for a live deployment, `development` locally.
- `PUBLIC_BRANDING` — must match the `key` in `src-private/branding.json`.
- `INSTANCE_ADMIN` — the hall's contact email shown to users.
- `PUBLIC_DB_PROVIDER` — `supabase` (see §0).
- `JWT_SECRET` — **(secret)**. Generate a 256-bit hex key, e.g.
  `openssl rand -hex 32`. This signs the app's own session token. Use a long
  random value in production and keep it out of source control.
- `MAINTENANCE_MODE` — `true`/`false`. Also toggleable via Cloudflare KV.
- `PUBLIC_FEATURE_LIST` — JSON object of extra feature flags, e.g. `{}`.

### Supabase (required in `supabase` mode)

- `PUBLIC_SUPABASE_URL` — your project URL, `https://<ref>.supabase.co`.
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` — the **anon/publishable** key. This is
  designed to be public; Row-Level Security (Section 5) is what protects data.

### Google OAuth (if using Google sign-in)

- `PUBLIC_GI_CLIENT_ID` — OAuth client id (`*.apps.googleusercontent.com`).
- `GI_CLIENT_SECRET` — **(secret)** OAuth client secret.

### Google service account (if using Firestore uploads / push / Sheets)

- `GOOGLE_SERVICE_ACCOUNT_JSON` — **(secret)** the full service-account JSON
  object, single-line, as created by the Google Cloud console. Used to
  read/write Firestore and Sheets server-side.

### Firestore + push (optional)

- `PUBLIC_APP_FIREBASE_ENABLED` — `true` to enable upload/push features.
  Note the name is historical; it gates Firestore usage, not Firebase Auth.
- `PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key from the Cloudflare worker
  (`wrangler secret put VAPID_PUBLIC_KEY`) or your env.
- `VAPID_PRIVATE_KEY` — **(secret)** VAPID private key.
- `CRON_SECRET` — **(secret)** shared secret for the scheduled-jobs endpoint.
  Required if you enable laundry reminders.

### Google Sheets (only in `sheets` mode)

- `PUBLIC_GS_AW_ID` — Accounting workbook ID.
- `PUBLIC_GS_RR_ID` — Resident Records workbook ID.
- `PUBLIC_GS_SR_ID` — Shared Records workbook ID.

### Analytics (optional)

- `PUBLIC_GA_ID` — Google Analytics measurement ID.
- `PUBLIC_GSV_ID` — Google Search Console site-verification token.

---

## 5. Database: fresh Supabase installation

There are **two** ways to create the database, and you should use only ONE.

### 5A. Recommended — the consolidated baseline (single authoritative migration)

For a brand-new, empty database, run the consolidated baseline instead of
walking the 17 historical migrations. It reproduces the final schema exactly:
all tables, constraints, indexes, functions, triggers, views and RLS policies.

1. Supabase Dashboard → **SQL Editor** → New query.
2. Ensure the target is an empty project (no HAOne tables yet). The baseline
   refuses to run if HAOne objects already exist, to protect real data.
3. Paste and run, in this order:
   - `migrations/baseline/000_baseline_schema.sql` — the full schema.
   - `migrations/baseline/001_reference_seed.sql` — required system accounts,
     the MOP list, and the achievements feature flag.

The seed contains **no** fake residents, transactions, fees, or balances. It
contains only the two hardcoded system accounts, payment methods, and a feature
flag. It deliberately does **not** create academic terms, fee amounts, or
officer accounts — those are institution-specific and must be supplied by you
(Section 5C). The seed ends with a verification block that raises an error if
the required system accounts or MOP list are missing, and a warning if no
officer exists yet.

After the baseline you have an empty-but-correct system, ready for your real
data to be imported.

### 5B. Alternative — replay the historical migrations (existing deployments)

If you are upgrading or rebuilding a database that was created from the original
numbered migrations, apply them in filename order exactly once, as `postgres`:

```
migrations/20240425000000_initial_schema.sql
migrations/20260729000000_auth_uid_linking_and_rls.sql
migrations/20260815000000_journal_drop_emails_use_ids.sql
migrations/20260816000000_laundry_rls_account_type.sql
migrations/20260914000000_schema_consistency_fixes.sql
migrations/20260915000000_rename_curr_to_registrations.sql
migrations/20260923000000_laundry_booking_visibility.sql
migrations/20260923000000_maintenance_gas_fees.sql
migrations/20260924000000_laundry_machine_area.sql
migrations/20260924000000_payment_requests_self_update.sql
migrations/20260925000000_occupied_beds_rpc.sql
migrations/20260925020000_student_no_taken_rpc.sql
migrations/20260926000000_achievements_feature_flag.sql
migrations/20260926010000_constants_terms_seed.sql
migrations/20260926020000_mop_types_seed.sql
migrations/20260926100000_users_auto_link_auth.sql
```

> **Danger:** `20240425000000_initial_schema.sql` begins by **dropping** existing
> HAOne tables. Only run it against a genuinely empty database. Never point it
> at a database that holds real data. `migrations/README.md` documents the full
> ordering and caveats; read it before replaying.

Do **not** run both 5A and 5B on the same project.

### 5C. Supply your real configuration data

The baseline intentionally ships empty where the correct value is
institution-specific. Before real use, add via SQL Editor or the app's admin UI:

1. **Academic terms** — e.g. `TERM_2627_1S` → `2627_1S`, and a
   `TERM_CURR` row naming the active term. The baseline's
   `001_reference_seed.sql` Section 4 has a ready template with the exact key
   format; replace the term code with your own. **Note:** the old
   `constants` table is populated from Sheets; in a pure-Supabase install you
   must seed it (Section 5A) or add terms in the app (Admin → Academic Terms).
2. **Fees** — `FEES_<TERM>_{ASSOC,WATER,MAINTENANCE,TOTAL,...}` constants for
   the active term, at your real amounts.
3. **At least one officer** — an `officers` row with the email of the person
   who administers the hall. Without an officer, `is_officer()` is false for
   everyone and nobody can write data. `001_reference_seed.sql` Section 5 has a
   template; use your real email.

Never ship placeholder terms, fees, or a template admin email in production.

---

## 6. Supabase Auth configuration

1. Supabase Dashboard → **Authentication** → **Providers**.
2. Enable **Email** (and/or **Google**).
3. For Google, add your OAuth client id/secret and set the redirect URL to
   `https://<your-app-domain>/auth/callback` (and the localhost equivalent for
   development). Supabase prints the exact callback URL to copy.
4. Optionally disable email sign-ups if residents are created by an admin sync.

HAOne links database rows to auth identities through `users.auth_uids`
(a UUID array), resolved by `current_user_id()`. The sign-up trigger
(`on_auth_user_created`) creates a profile for a new auth user, and
`users_link_auth_identity` back-links profiles created outside auth (e.g. by an
admin sync) by matching email. You do not need to manage `auth_uids` manually.

---

## 7. Firestore (only if you use uploads / push / Sheets)

HAOne reads/writes Firestore directly with the Google service account. There is
**no** Firebase client SDK and **no** Firebase project configuration file in
this repo.

1. In Google Cloud, enable the **Firestore API** and create a database in the
   region nearest your users.
2. Create a service account with a JSON key and grant it access to the
   Firestore database. Copy the JSON into `GOOGLE_SERVICE_ACCOUNT_JSON`.
3. Install your organization's data-retention and access rules as Firestore
   security rules or IAM policy as your institution requires — HAOne does not
   ship any, and it does not rely on Firestore client-side rules.
4. Collections HAOne uses:
   - `uploads` — documents with `{ data (base64 data-URI), contentType, createdAt }`.
     Resident pictures and receipt images. Raw uploads are capped at ~700 KB
     because Firestore documents are size-limited; the app enforces this and
     shows a clear error if you exceed it.
   - `push_subscriptions` — web-push subscription documents keyed by resident.
     Needed only if you enable push notifications.

If you only run the app without uploads/push and without Sheets, you can leave
Firestore and `GOOGLE_SERVICE_ACCOUNT_JSON` unset.

---

## 8. Google Sheets mode (legacy — optional)

Only if `PUBLIC_DB_PROVIDER=sheets`. You need three Google Sheets workbooks
(Accounting, Resident Records, Shared) with the layouts the app expects, the
`PUBLIC_GS_AW_ID` / `PUBLIC_GS_RR_ID` / `PUBLIC_GS_SR_ID` IDs, and a service
account with edit access to all three. New installations are strongly
discouraged from using this mode; prefer Supabase.

---

## 9. Scheduled jobs (laundry reminders)

If you use laundry reminders, the app exposes `GET /api/tasks/cron?secret=...`.
Wire a scheduler (Cloudflare Cron, GitHub Actions, an external cron service) to
call it with `?secret=<CRON_SECRET>` on a suitable schedule (e.g. hourly). The
endpoint compares the query `secret` to `CRON_SECRET` and runs the reminder job.
Keep `CRON_SECRET` secret and non-empty.

---

## 10. Cloudflare Workers deployment (the target platform)

This project uses `@sveltejs/adapter-cloudflare`.

1. Install dependencies and confirm the build works locally:
   ```bash
   npm run build
   ```
2. Create a Cloudflare account and install Wrangler.
3. Create a `wrangler.jsonc` (git-ignored) with at least the build output and
   compatibility flags your Workers plan needs. The minimum the adapter needs:
   ```jsonc
   {
     "name": "haone",
     "compatibility_date": "2025-01-01",
     "compatibility_flags": ["nodejs_compat"],
     "assets": { "binding": "ASSETS", "directory": ".svelte-kit/output/client" },
     "main": ".svelte-kit/cloudflare/_worker.js"
   }
   ```
   Adjust the compatibility date to your account's supported values.
4. Put **secrets** (not plaintext) on the Worker:
   ```bash
   wrangler secret put JWT_SECRET
   wrangler secret put GI_CLIENT_SECRET
   wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
   wrangler secret put VAPID_PRIVATE_KEY
   wrangler secret put CRON_SECRET
   ```
5. Set the non-secret `PUBLIC_*` variables as Worker vars (or a `.dev.vars`
   locally). Note: anything prefixed `PUBLIC_` is embedded in the client bundle
   and is public — never put a secret behind a `PUBLIC_` name.
6. Deploy:
   ```bash
   wrangler deploy
   ```
7. Point your domain at the Worker and (optionally) put Cloudflare in front of
   Supabase Auth redirects as needed.

`static/_headers` sets `X-Robots-Tag: noindex, nofollow` for a portal that
should not be publicly indexed; keep or adjust that header deliberately.

---

## 11. Local development

```bash
cp .env.example .env        # edit as in Section 4
cp -r src-private-example src-private
npm install
npm run dev
```

Use a separate Supabase project (or schema) for development so you never risk
real data. For local Workers testing: `npx wrangler dev`.

---

## 12. First-run checklist

- [ ] Database created (baseline 5A or migrations 5B) and verified.
- [ ] Your real academic term(s) added and `TERM_CURR` set to the active term.
- [ ] Real fee amounts seeded for the active term.
- [ ] At least one officer added (their real email).
- [ ] `PUBLIC_DB_PROVIDER` matches the backend you actually installed.
- [ ] `JWT_SECRET` set to a strong random secret.
- [ ] Supabase Auth providers enabled and Google redirect URL configured.
- [ ] `src-private/` created and branded; `PUBLIC_BRANDING` matches its key.
- [ ] If using Firestore: service account JSON set, Firestore database exists,
      `uploads` collection writable by the service account.
- [ ] If using push: VAPID keys set and `PUBLIC_APP_FIREBASE_ENABLED=true`.
- [ ] If using reminders: `CRON_SECRET` set and a scheduler calls
      `/api/tasks/cron`.
- [ ] Secrets are on the Worker as `wrangler secret`, not in source control.
- [ ] Sign in as the officer and confirm you can create a resident/transaction.

---

## 13. Post-baseline verification (Supabase)

Run these read-only checks in the SQL Editor after 5A. They should match the
expectations shown.

```sql
-- 1. The 13 HAOne tables exist, and the legacy `curr` table does NOT.
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1;
-- expect: accounts, achievement_records, achievements, announcements, constants,
--         fridge_items, journal, laundry, officers, payment_requests,
--         registrations, user_settings, users
SELECT to_regclass('public.curr');  -- expect: NULL

-- 2. All 9 helper/RPC functions exist.
SELECT routine_name FROM information_schema.routines
 WHERE routine_schema='public'
   AND routine_name IN ('is_officer','current_user_id','can_access_laundry',
     'get_occupied_beds','student_no_taken','get_achievement_eligible_counts',
     'get_receipt_by_id','handle_new_auth_user','link_users_to_auth')
 ORDER BY 1;

-- 3. Both identity triggers exist.
SELECT tgname FROM pg_trigger
 WHERE NOT tgisinternal
   AND tgrelid IN ('auth.users'::regclass,'public.users'::regclass)
 ORDER BY 1;
-- expect: on_auth_user_created, users_link_auth_identity

-- 4. The journal no longer stores the legacy email columns.
SELECT column_name FROM information_schema.columns
 WHERE table_name='journal' AND column_name IN ('creator_email','account_email');
-- expect: 0 rows

-- 5. RLS is enabled on all 13 HAOne tables (expect 13).
SELECT COUNT(*) FROM pg_tables
 WHERE schemaname='public' AND rowsecurity
   AND tablename IN ('users','officers','accounts','journal','laundry',
     'payment_requests','announcements','user_settings','achievements',
     'achievement_records','constants','registrations','fridge_items');

-- 6. The two system accounts exist (from the seed).
SELECT email FROM public.users
 WHERE id IN ('65eb6240-8200-48dd-a1b9-01c5994c77d7',
              '45ee82f7-103f-4607-80b8-6377a76441b7');
-- expect: _funds, _imported

-- 7. An officer exists (no rows here means nobody can write yet).
SELECT email, position FROM public.officers;
```

---

## 14. Where the historical migration notes live

The original per-migration reasoning, ordering notes, and gotchas are preserved
in `migrations/README.md`. Read it if you are replaying migrations (5B) or
debugging a schema question. The baseline (5A) is the faster path for a fresh
install.

---

## 15. Security notes

- **Never** commit `.env`, `src-private/`, `Google_OAuth_Client.json`, or any
  service-account/VAPID/JWT secret. The repo's `.gitignore` covers these; keep it
  that way.
- `PUBLIC_*` variables are shipped to the browser. Only put non-sensitive values
  behind a `PUBLIC_` name.
- Row-Level Security is the real data boundary in Supabase. The anon/publishable
  key is safe to expose **because** RLS is enabled on every HAOne table
  (verify with check 5 above). Do not disable RLS.
- The public receipt RPC (`get_receipt_by_id`) is intentionally readable by
  anonymous visitors but exposes only receipt-safe fields.
- Rotate `JWT_SECRET`, OAuth secrets, and VAPID keys if they are ever exposed.
