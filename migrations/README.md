# HAOne Database Migration Guide

This document MUST be followed to migrate (or set up) the HAOne Supabase database successfully.

---

## 1. How migrations work in this project

- There is **no automatic migration runner**. Every file in this folder is plain SQL that must be run **manually, in order**, from the **Supabase Dashboard → SQL Editor** (running as `postgres`), or via `psql`.
- There is **no migration-tracking table**. You must keep track of the highest prefix already applied (the timestamp in the filename). Record it in a note after each run — the verification queries in §5 tell you what is already present.
- Files are named `<timestamp>_<description>.sql` and must be applied in **ascending timestamp order**.
- `seed.sql` has no timestamp — it is static seed data and is run **last**.

## 2. Prerequisites

1. A Supabase project. In the app's `.env` set:
   - `PUBLIC_DB_PROVIDER=supabase`
   - `PUBLIC_SUPABASE_URL=<your project URL>`
   - `PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>`
2. Supabase **Auth** enabled with at least one sign-in provider (email or Google). The `auth.users` table must exist (it is created automatically by Supabase; the trigger in file 001 links it to `public.users`).
3. SQL Editor access with the `postgres` role.

## 3. Choose your path

### Path A — Brand-new / empty database

> **CRITICAL:** `20240425000000_initial_schema.sql` begins with a **TEARDOWN** that drops every HAOne table.
> Run it **only** against a database that is empty or that you intend to wipe.
> **NEVER** run it against a database that already contains HAOne data.

1. Run every numbered file in the order shown in §4, left to right.
2. Edit the placeholders in `seed.sql` (see §6), then run it.

### Path B — Existing instance (Supabase already has HAOne data)

1. **Do NOT run `20240425000000_initial_schema.sql`.** It will drop all your data.
2. Determine the highest migration already applied by running the verification queries in §5 and comparing missing objects against the "Adds" column in §4.
3. Apply **only** the files with a timestamp prefix **later** than what is already applied, in order.
4. If in doubt, apply only files you know are missing (verify with §5). Re-running is **only** safe for files marked "Yes" in §4 — file 1 and file 8 are **not** re-runnable, and file 5 only while `curr` still exists, so never apply those twice.
5. `seed.sql` is safe to run repeatedly (uses `ON CONFLICT DO NOTHING`), but run it **after** editing the placeholders.

## 4. Migration files — apply order and purpose

| # | File | Adds / changes | Safe to re-run? |
|---|------|----------------|-----------------|
| 1 | `20240425000000_initial_schema.sql` | Base schema + RLS: `users`, `users_view`, `officers`, `accounts`, `journal`, `laundry`, `payment_requests`, `announcements`, `user_settings`, `achievements`, `achievement_records`, `constants`, `curr`, `fridge_items`; `is_officer()`; sign-up trigger. ⚠️ Contains full teardown. | No |
| 2 | `20260729000000_auth_uid_linking_and_rls.sql` | `users.auth_uids`, `current_user_id()`, rewritten policies replaced by UID, resident self-registration into `curr`. | Yes |
| 3 | `20260815000000_journal_drop_emails_use_ids.sql` | `journal.creator_id` / `journal.account_id` (with backfill), drops `journal.creator_email` / `account_email`, new journal RLS. | Yes |
| 4 | `20260816000000_laundry_rls_account_type.sql` | `can_access_laundry()`; laundry RLS restricted to eligible account types. | Yes |
| 5 | `20260914000000_schema_consistency_fixes.sql` | `fridge_items` (if missing), `user_settings.calendar_view`, `curr.decline_reason`, `achievement_records.created_at`, `accounts.issuer_id` FK fix. ⚠️ References `curr` directly — errors if run after file 6 (rename). | Only while `curr` still exists |
| 6 | `20260915000000_rename_curr_to_registrations.sql` | Renames `curr` → `registrations` (creating it from scratch if needed) + `registrations_*` policies. | Yes |
| 7 | `20260923000000_laundry_booking_visibility.sql` | Laundry `SELECT` policy widened so eligible residents see all slots (booking conflicts). | Yes |
| 8 | `20260923000000_maintenance_gas_fees.sql` | `journal.maintenance` / `gas`, `payment_requests.maintenance_fee` / `gas_fee`, public `get_receipt_by_id()`. ⚠️ Uses plain `ADD COLUMN` — errors if run twice. | No |
| 9 | `20260924000000_laundry_machine_area.sql` | `laundry.machine` (LEFT_WING / RIGHT_WING) with backfill + NOT NULL. | Yes |
| 10 | `20260924000000_payment_requests_self_update.sql` | Residents may update (cancel) their own `payment_requests`. | Yes |
| 11 | `20260925000000_occupied_beds_rpc.sql` | RLS-safe `get_occupied_beds()` for the onboarding bed picker. | Yes |
| 12 | `20260925020000_student_no_taken_rpc.sql` | RLS-safe `student_no_taken(text)` duplicate student-number guard. | Yes |
| 13 | `20260926000000_achievements_feature_flag.sql` | RLS-safe `get_achievement_eligible_counts()` (fixes "X% of residents" stat in Supabase mode) + `FEATURE_ACHIEVEMENTS_ENABLED` constant seeded to `FALSE` (kill switch). | Yes |
| 14 | `seed.sql` | Seed data: sample resident, RHA system accounts (`_funds`, `_imported`, `_dummy`), an officer. | Yes |

**Why 13 (the last numbered file) matters:** in Supabase mode the resident achievements page cannot count eligible residents itself (RLS blinds it), so `get_achievement_eligible_counts()` provides per-term headcounts. At the same time the `FEATURE_ACHIEVEMENTS_ENABLED = 'FALSE'` constant **hides Achievements and Leaderboards from navigation and pages**. Toggle to `TRUE` to re-enable.

## 5. Post-migration verification

Run each check in the Supabase SQL Editor after the final migration. All should return as shown.

1. Expected public functions present:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_officer', 'current_user_id', 'can_access_laundry',
    'get_occupied_beds', 'student_no_taken',
    'get_achievement_eligible_counts', 'get_receipt_by_id',
    'handle_new_auth_user'
  )
ORDER BY 1;
```

2. Expected public tables present (and `curr` gone):

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
-- expect: accounts, achievement_records, achievements, announcements,
-- constants, fridge_items, journal, laundry, officers, payment_requests,
-- registrations, user_settings, users
SELECT to_regclass('public.curr'); -- expect NULL
```

3. Key constants present:

```sql
SELECT key, value FROM public.constants ORDER BY key;
-- expect at least: TERM_CURR, FEATURE_ACHIEVEMENTS_ENABLED (value FALSE)
```

4. No legacy journal email columns remain:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'journal' AND column_name IN ('creator_email', 'account_email');
-- expect zero rows
```

5. Laundry machine column present and non-null:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'laundry' AND column_name = 'machine';
-- expect 1 row
```

## 6. `seed.sql` — before you run it

- Two blocks contain the placeholder `<REPLACE THIS WITH EMAIL>` (one for the sample resident `users` row, one for the `officers` row). Fill them in with a **real email** before running.
- The **officer email must match the Auth email of the admin user** — `is_officer()` (`LANGUAGE sql`, checks JWT email against `officers.email`) decides who has write access everywhere. If you skip the officer row, no authenticated user can write data.
- The system accounts `_funds`, `_imported`, `_dummy` are used as journal author/recipient placeholders; keep them.

## 7. After migration (app side)

1. `.env` is correctly set (see §2).
2. Restart the app, sign in as the officer seeded in step §6, and confirm:
   - Officers can view/write residents, transactions, announcements.
   - A resident sign-in can see their own account, journal, laundry, fridge.
   - Achievements/Leaderboards are **hidden** (because `FEATURE_ACHIEVEMENTS_ENABLED = FALSE`); set it to `TRUE` in the `constants` table to show them again.
   - Public receipt lookup (`/receipt/[id]`) works — requires `get_receipt_by_id()`.

## 8. Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `policy "..." already exists` | `20240425000000_initial_schema.sql` run twice | You likely re-ran file 1. Never re-run file 1 on an existing DB. |
| `relation "public.curr" does not exist` | File 5 run after file 6 (rename) | Do not re-run file 5 once `registrations` exists; its only remaining value there is covered by later files. On a fresh DB the order in §4 avoids this. |
| `column "maintenance" ... already exists` (or `gas`) | File 8 run twice | Do not re-run file 8; verify fee columns are present and leave them. |
| `function student_no_taken ... does not exist` | File 12 missing | Run files ≥ 12. |
| `RPC get_achievement_eligible_counts ... could not find function` | File 13 missing | Run file 13; without it the achievements page still renders but shows 0% counts. |
| Achievements/Leaderboards still visible in app | `FEATURE_ACHIEVEMENTS_ENABLED` absent or `TRUE` | `SELECT * FROM constants WHERE key='FEATURE_ACHIEVEMENTS_ENABLED';` then set value to `FALSE`. |
| Data wiped | `initial_schema.sql` run on a populated DB | Not recoverable. Restore from a Supabase backup/snapshot; never run file 1 on a populated DB. |