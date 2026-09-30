# HAOne — Test Data Cleanup

How to remove records that were created as test data, from every store HAOne
uses, **without ever touching real data**.

- Script: `scripts/cleanup-test-data.mjs`
- Manifest template: `scripts/test-data-manifest.example.json`

---

## 1. What this cleans, and what it does not

| Store                           | Cleaned | How it is targeted                                              |
| ------------------------------- | ------- | --------------------------------------------------------------- |
| Firestore `push_subscriptions`  | Yes     | Explicit document IDs in the manifest                           |
| Firestore `uploads`             | Yes     | Explicit document IDs in the manifest                           |
| Supabase Auth (`auth.users`)    | Yes     | Emails listed in the manifest                                   |
| Supabase `public.*` (13 tables) | Yes     | Rows belonging to the listed residents, children before parents |

**Not applicable — do not configure these, they do not exist in HAOne:**

- Firebase Authentication. HAOne authenticates with **Supabase Auth** (and Google
  OAuth as a provider). There is no Firebase Auth project, and the script deletes
  Supabase Auth users instead.
- Firebase Storage. There is no Storage bucket. Uploaded images live in
  **Firestore** documents, not Storage, and are cleaned by document ID.
- Firestore security rules / indexes. HAOne talks to Firestore server-side with a
  service account and ships no `firebase.json`, `firestore.rules`, or
  `firestore.indexes.json`. The queries it issues are single-collection lookups
  by primary key, so no composite index is required.
- Google Sheets. Only relevant in the legacy `sheets` mode. Sheets have no
  primary keys, so there is no safe automated cleanup — clear test rows manually
  in the workbook. This script never touches Sheets.

---

## 2. Required environment

Set in `.env` (git-ignored) or exported in your shell:

```
PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...        <- service_role, server-only
GOOGLE_SERVICE_ACCOUNT_JSON=...      <- only if cleaning Firestore
```

`SUPABASE_SERVICE_ROLE_KEY` comes from **Supabase dashboard → Project Settings →
API Keys → service_role**. It bypasses Row-Level Security, so:

- Never name it with a `PUBLIC_` prefix (`PUBLIC_*` values are shipped to the
  browser).
- Never commit it.
- Keep `.env` git-ignored. Verify with `git check-ignore .env` before you start.

If the variable is missing the script aborts immediately and deletes nothing.

---

## 3. The manifest

The manifest is the whole safety story. **The script only deletes what is
listed.** There is no truncate, no `DELETE FROM table`, and no "clean the
database" mode.

```jsonc
{
  "label": "testrun-2026-05-01", // must be repeated as --confirm
  "residents": {
    "emails": ["resident.one@example.com"],
    "ids": [],
    "testPeriods": ["2627_1S"] // REQUIRED
  },
  "firestore": {
    "push_subscriptions": [],
    "uploads": ["<firestore upload doc id>"]
  },
  "allowNonTestEmails": false
}
```

### 3.1 `testPeriods` is mandatory

The schema has no `is_test` column, and the script will not add one — that would
change the database structure. So "is this test data?" is answered two ways:

1. The record is **explicitly listed** in the manifest, AND
2. its email **looks like a test account**.

For financial history the script adds a third check: a listed resident may only
have `journal` rows whose `period` is in `testPeriods`. If a matched resident has
journal rows in any other term, the script **refuses to delete anything** and
prints those rows. That is the signal that the resident is real and the manifest
is wrong.

Use a real, recognisable test term code (for example `9999_TEST`) rather than a
real term, so the check stays meaningful.

### 3.2 Test email patterns

A listed email must match one of these, or the run aborts:

```
@example.com | @example.org | @example.net
@<anything>.invalid
test...      e.g. test.resident1@, test_resident1@
..._test@    ...-test@   ...test@
demo@  qa@  ci@  bot@  @sentry.io
```

This is the protection against a mistyped manifest wiping a real resident. If a
genuine test account has a real-looking address, set `"allowNonTestEmails":
true` and write down why in the file.

### 3.3 Never-deleted records

Hard-blocked in code, regardless of the manifest:

- `_funds` — `65eb6240-8200-48dd-a1b9-01c5994c77d7`
- `_imported` — `45ee82f7-103f-4607-80b8-6377a76441b7`

These are the internal ledger identities from `src/lib/constants.ts`
(`SYSTEM_IDS`). The script aborts if either appears in a manifest.

---

## 4. Running it

### Step 1 — dry run (always do this first)

```bash
node scripts/cleanup-test-data.mjs --manifest scripts/test-data-manifest.json
```

Dry run is the **default**. It prints exactly what it would delete and changes
nothing. Read the output carefully, especially the matched resident list and the
out-of-period journal check.

### Step 2 — execute

```bash
node scripts/cleanup-test-data.mjs \
  --manifest scripts/test-data-manifest.json \
  --execute \
  --confirm "testrun-2026-05-01"
```

`--confirm` must match the manifest `label` exactly. Without both flags the
script will not delete anything.

### Step 3 — verify

Re-run the dry run; it should report 0 matched residents. Then check the app and
the database.

### Selective stages

```bash
--skip-firestore   # DB + Auth only
--skip-auth        # DB + Firestore only
--skip-db          # Firestore + Auth only
```

### Overriding the history guard

`--force` bypasses the out-of-period journal check. Use it **only** on a
genuinely disposable environment, and never against the live project. The script
prints a warning when it is used.

---

## 5. Order of operations

Children are deleted before parents, so you never trip a foreign key or orphan a
row:

1. **Firestore** `push_subscriptions`, then `uploads`
2. **Supabase Auth** — test logins
3. **Supabase DB**
   `achievement_records` → `fridge_items` → `laundry` → `payment_requests` →
   `journal` → `accounts` → `registrations` → `user_settings` → `announcements`
   → `achievements` → `users`

Auth is removed **before** the database rows on purpose. Removing the DB rows
first would leave orphaned `auth.users` entries that can still sign in, which
defeats the purpose of the cleanup.

---

## 6. Tests and staging environments

For a **disposable** test or staging environment you can also reset the database
structurally, because there is no real data to lose:

```sql
-- ONLY on a disposable environment. NEVER on production.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO anon;
```

Then re-apply `migrations/baseline/000_baseline_schema.sql` and
`001_reference_seed.sql`. Note that the baseline **refuses to run if HAOne tables
exist**, so you must drop them first. After a schema reset, delete the Firestore
`uploads` / `push_subscriptions` documents and the Supabase Auth users for that
environment too — a schema reset does not touch them.

Keep destructive resets limited to disposable environments. The manifest-based
script in this document is the method to use anywhere you care about data.

---

## 7. Verification queries

After a cleanup, run these read-only checks.

```sql
-- 7.1 No test residents remain.
SELECT id, email FROM public.users
 WHERE LOWER(email) LIKE '%@example.com'
    OR LOWER(email) LIKE 'test%'
    OR LOWER(email) LIKE '%_test@';

-- 7.2 No orphaned journal rows (account_id no longer exists).
--     account_id is ON DELETE SET NULL, so a bad cleanup shows up here.
SELECT COUNT(*) AS orphaned_journal
  FROM public.journal j
  LEFT JOIN public.users u ON u.id = j.account_id
 WHERE j.account_id IS NOT NULL AND u.id IS NULL;

-- 7.3 No orphaned account rows.
SELECT COUNT(*) AS orphaned_accounts
  FROM public.accounts a
  LEFT JOIN public.users u ON u.id = a.resident_id
 WHERE a.resident_id IS NOT NULL AND u.id IS NULL;

-- 7.4 The system accounts survived.
SELECT email FROM public.users
 WHERE id IN ('65eb6240-8200-48dd-a1b9-01c5994c77d7',
              '45ee82f7-103f-4607-80b8-6377a76441b7');
-- expect: _funds, _imported
```

In the Firestore console, confirm the `uploads` and `push_subscriptions`
documents named in the manifest are gone.

---

## 8. What is deliberately NOT handled

- **Google Sheets** (legacy `sheets` mode) — no primary keys, so no safe
  automated delete. Clear test rows manually.
- **Cloudflare KV** — only holds maintenance-mode state, not resident data.
- **Local browser state** — per-device. Not server data; clearing site data
  (localStorage keys under `halsk.*`) removes it.
- **PDF/report files** — generated client-side, never persisted server-side.
- **The `_dummy` legacy user** — not present in a baseline install and not
  referenced by any code path, so there is nothing to clean. If an old
  environment still has it, remove it with an explicit one-off `DELETE`, not
  through this script.

---

## 9. Safety summary

| Protection             | Behaviour                                                    |
| ---------------------- | ------------------------------------------------------------ |
| Dry run default        | Nothing is deleted without `--execute`                       |
| Double confirmation    | `--execute` **and** `--confirm "<label>"` must both match    |
| Manifest-only          | No blanket deletes exist anywhere in the script              |
| Email pattern check    | Non-test-looking emails abort the run                        |
| `testPeriods` required | Aborts if the manifest omits known test-only terms           |
| History guard          | Refuses to delete a resident with out-of-period journal rows |
| System accounts        | `_funds` / `_imported` are hard-blocked in code              |
| No schema change       | No `is_test` column is added to any table                    |
| Ordered deletes        | Children before parents; Auth before DB                      |
| Fail-closed            | Missing credentials abort before any deletion                |
