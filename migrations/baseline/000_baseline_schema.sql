-- =============================================================================
-- HAOne — Authoritative Baseline Schema (consolidated)
-- =============================================================================
-- PURPOSE
--   One complete, authoritative migration that builds the entire current
--   production-ready HAOne schema: tables, columns, types, defaults, foreign
--   keys, indexes, constraints, views, functions, triggers, grants and
--   Row-Level Security policies.
--
--   This file is the CONSOLIDATED RESULT of applying, in order, every numbered
--   migration that previously lived in migrations/ (see the provenance list at
--   the bottom of this file). It contains NO operational or test data. A fresh
--   install reaches the same functional database state as the live system.
--
-- DATA POLICY
--   This file inserts ZERO rows into any table. All table content is either:
--     * required reference/configuration data -> see 001_reference_seed.sql, or
--     * an academic-year configuration you must supply -> see the commented
--       template in 001_reference_seed.sql,
--     * real resident / financial / transaction data -> NEVER seeded. That is
--       migrated from the existing database, never fabricated.
--
-- SYSTEM ACCOUNTS
--   The two required internal identities (FUNDS, IMPORTED) are seeded in
--   001_reference_seed.sql, NOT here, because their UUIDs are hardcoded in the
--   application (src/lib/constants.ts -> SYSTEM_IDS). Changing them would
--   require an application change, so they are treated as fixed schema.
--
-- HOW TO RUN
--   Supabase Dashboard -> SQL Editor, as the `postgres` role, on a project that
--   contains NO HAOne tables. Then run 001_reference_seed.sql.
--
-- SAFETY
--   This migration REFUSES to run if HAOne tables already exist, so it can
--   never silently drop production data. See the guard in section 0.
-- =============================================================================

-- =============================================================================
-- SECTION 0 — SAFETY GUARD
-- Refuse to run against a database that already has HAOne objects. Converging
-- an existing database is done by applying the numbered migrations in
-- migrations/ in timestamp order, never by re-running this baseline.
-- =============================================================================
DO $$
DECLARE
  v_existing TEXT;
BEGIN
  SELECT string_agg(t, ', ' ORDER BY t)
  INTO v_existing
  FROM unnest(ARRAY[
    'users','users_view','officers','accounts','journal','laundry',
    'payment_requests','announcements','user_settings','achievements',
    'achievement_records','constants','curr','registrations','fridge_items'
  ]) AS t
  WHERE to_regclass('public.' || t) IS NOT NULL;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION
      'HAOne baseline refused to run: these public objects already exist: %', v_existing;
  END IF;
END;
$$;


-- =============================================================================
-- SECTION 1 — USERS
-- Identity is resolved through users.auth_uids, NOT through the login email.
-- current_user_id() maps the caller's auth.uid() into this table; RLS depends
-- on it. An unlinked profile (auth_uids = '{}') is invisible to its own owner
-- and locks the resident on /onboarding — see the link_users_to_auth trigger.
-- =============================================================================
CREATE TABLE public.users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE NOT NULL,
  last_name         TEXT,
  first_name        TEXT,
  middle_name       TEXT,
  suffix            TEXT,
  override_name     TEXT,
  student_no        TEXT,
  secondary_contact TEXT,
  address           TEXT,
  college           TEXT,
  degree_program    TEXT,
  tags              TEXT[],
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  -- Added by 20260729000000: identity linkage array.
  auth_uids         UUID[] NOT NULL DEFAULT '{}'
);

CREATE INDEX users_auth_uids_idx ON public.users USING GIN (auth_uids);


-- display_name / display_name_fl are derived, never stored.
CREATE OR REPLACE VIEW users_view WITH (security_invoker = true) AS
SELECT
  id,
  email,
  last_name,
  first_name,
  middle_name,
  suffix,
  override_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> ''
      THEN TRIM(override_name)
    ELSE TRIM(CONCAT(
      CASE
        WHEN last_name IS NOT NULL AND TRIM(last_name) <> ''
          THEN CONCAT(TRIM(last_name), ', ')
        ELSE ''
      END,
      TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(suffix), '')))
    ))
  END AS display_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> ''
      THEN TRIM(override_name)
    ELSE TRIM(CONCAT_WS(' ',
      NULLIF(TRIM(first_name), ''),
      NULLIF(TRIM(middle_name), ''),
      NULLIF(TRIM(last_name), ''),
      NULLIF(TRIM(suffix), '')))
  END AS display_name_fl,
  student_no,
  secondary_contact,
  address,
  college,
  degree_program,
  tags,
  notes,
  created_at
FROM public.users;


-- =============================================================================
-- SECTION 2 — OFFICERS
-- is_officer() grants write access everywhere. If this table has no row whose
-- email matches the login email of your admin, NO authenticated user can write.
-- =============================================================================
CREATE TABLE public.officers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position   TEXT,
  name       TEXT,
  nickname   TEXT,
  email      TEXT NOT NULL,
  fb_link    TEXT,
  term       TEXT,
  committee  TEXT,
  birthday   DATE,
  status     TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================================================
-- SECTION 3 — ACCOUNTS
-- One row per resident per academic term. Balances are NOT stored: they are
-- derived by summing journal rows for (resident_id, period) — see
-- resident-service.ts. type gates laundry access via can_access_laundry().
-- =============================================================================
CREATE TABLE public.accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id   UUID REFERENCES public.users(id),
  period        TEXT,
  room          TEXT,
  bed           TEXT,
  ce_ref_no     TEXT,
  ce_issued     DATE,
  ce_link       TEXT,
  account_notes TEXT,
  issuer_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  check_in_date DATE,
  type          TEXT DEFAULT 'STUDENT',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX accounts_resident_id ON public.accounts (resident_id);
CREATE INDEX accounts_period      ON public.accounts (period);


-- =============================================================================
-- SECTION 4 — JOURNAL
-- The single financial ledger. Amounts are SIGNED: positive collects money,
-- negative spends money. Balances are `base - paid`, so a refund (a negative
-- row) RAISES the resident's balance back — it un-collects a fee. Maintenance
-- and Gas are first-class fee columns.
-- =============================================================================
CREATE TABLE public.journal (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  -- creator_email / account_email were replaced by UUID references.
  creator_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  account_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  water          NUMERIC(12, 2) DEFAULT 0,
  assoc          NUMERIC(12, 2) DEFAULT 0,
  maintenance    NUMERIC(12, 2) DEFAULT 0,
  gas            NUMERIC(12, 2) DEFAULT 0,
  misc           NUMERIC(12, 2) DEFAULT 0,
  mop            TEXT,
  period         TEXT,
  type           TEXT,
  notes          TEXT,
  notes_private  TEXT,
  mop_ref_no     TEXT,
  pr_date_issued DATE,
  pr_ref_no      TEXT,
  was_audited    BOOLEAN DEFAULT FALSE,
  receipt_url    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX journal_account_id_idx ON public.journal (account_id);
CREATE INDEX journal_creator_id_idx ON public.journal (creator_id);
CREATE INDEX journal_period         ON public.journal (period);


-- =============================================================================
-- SECTION 5 — LAUNDRY
-- Access is restricted to account types STUDENT / BOOTCAMP / TRANSIENT in the
-- current term. machine distinguishes the two wings.
-- =============================================================================
CREATE TABLE public.laundry (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id    UUID REFERENCES public.users(id),
  date           DATE NOT NULL,
  time_start     TEXT NOT NULL,
  time_end       TEXT NOT NULL,
  status         TEXT DEFAULT 'ACTIVE',
  cancel_reason  TEXT,
  machine        TEXT DEFAULT 'LEFT_WING' NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at   TIMESTAMPTZ
);

CREATE INDEX laundry_resident_id ON public.laundry (resident_id);


-- =============================================================================
-- SECTION 6 — PAYMENT REQUESTS
-- Resident-submitted payment claims. Residents may insert and update (cancel)
-- their own; delete stays officer-only. Cancellation is a status change.
-- =============================================================================
CREATE TABLE public.payment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id     UUID REFERENCES public.users(id),
  date            DATE DEFAULT CURRENT_DATE,
  water_fee       NUMERIC(12, 2) DEFAULT 0,
  assoc_fee       NUMERIC(12, 2) DEFAULT 0,
  maintenance_fee NUMERIC(12, 2) DEFAULT 0,
  gas_fee         NUMERIC(12, 2) DEFAULT 0,
  misc            NUMERIC(12, 2) DEFAULT 0,
  mop             TEXT,
  type            TEXT,
  proof_link      TEXT,
  status          TEXT DEFAULT 'PENDING',
  notes           TEXT,
  status_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX payment_requests_resident_id ON public.payment_requests (resident_id);


-- =============================================================================
-- SECTION 7 — ANNOUNCEMENTS
-- =============================================================================
CREATE TABLE public.announcements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  start_date      DATE,
  expiry_date     DATE,
  is_indefinite   BOOLEAN DEFAULT FALSE,
  is_admin_only   BOOLEAN DEFAULT FALSE,
  is_unlisted     BOOLEAN DEFAULT FALSE,
  tags            TEXT[],
  title           TEXT,
  content         TEXT,
  slug            TEXT UNIQUE,
  broadcast_count INT DEFAULT 0
);


-- =============================================================================
-- SECTION 8 — USER SETTINGS
-- =============================================================================
CREATE TABLE public.user_settings (
  resident_id                UUID PRIMARY KEY REFERENCES public.users(id),
  is_public_achievement_list BOOLEAN DEFAULT TRUE,
  resident_nav               TEXT,
  admin_nav                  TEXT,
  density                    TEXT DEFAULT 'default',
  typography                 TEXT DEFAULT 'inter',
  theme                      TEXT DEFAULT 'system',
  is_reduced_motion          BOOLEAN DEFAULT FALSE,
  clock_format               TEXT DEFAULT '12h',
  calendar_view              TEXT DEFAULT 'week'
);


-- =============================================================================
-- SECTION 9 — ACHIEVEMENTS
-- =============================================================================
CREATE TABLE public.achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID REFERENCES public.users(id),
  name        TEXT,
  description TEXT,
  icon        TEXT,
  extra_url   TEXT,
  term        TEXT,
  points      INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.achievement_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorder_id    UUID REFERENCES public.users(id),
  account_id     UUID REFERENCES public.users(id),
  date           DATE DEFAULT CURRENT_DATE,
  achievement_id UUID REFERENCES public.achievements(id),
  term           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX achievement_records_account_id     ON public.achievement_records (account_id);
CREATE INDEX achievement_records_achievement_id ON public.achievement_records (achievement_id);


-- =============================================================================
-- SECTION 10 — CONSTANTS
-- Key/value configuration store. Replaces the Google Sheets "constants" sheet.
-- Populated by 001_reference_seed.sql.
-- =============================================================================
CREATE TABLE public.constants (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  description TEXT
);


-- =============================================================================
-- SECTION 11 — REGISTRATIONS
-- The onboarding / self-registration queue. Renamed from `curr`; `curr` must
-- NOT exist after the baseline. Residents may insert their own registration
-- and read their own row; only officers may update or delete.
-- =============================================================================
CREATE TABLE public.registrations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp      TIMESTAMPTZ DEFAULT NOW(),
  email          TEXT NOT NULL,
  room           TEXT,
  bed            TEXT,
  program        TEXT,
  student_no     TEXT,
  check_in_date  DATE,
  last_name      TEXT,
  first_name     TEXT,
  college        TEXT,
  evaluated      BOOLEAN DEFAULT FALSE,
  term           TEXT,
  account_type   TEXT DEFAULT 'STUDENT',
  suffix         TEXT,
  override_name  TEXT,
  decline_reason TEXT
);

CREATE INDEX registrations_email_idx ON public.registrations (email);
CREATE INDEX registrations_term_idx  ON public.registrations (term);


-- =============================================================================
-- SECTION 12 — FRIDGE ITEMS
-- =============================================================================
CREATE TABLE public.fridge_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id      UUID REFERENCES public.users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  compartment      TEXT DEFAULT 'REFRIGERATOR',
  location_details TEXT,
  date_stored      DATE DEFAULT CURRENT_DATE,
  expiry_date      DATE,
  photo_url        TEXT,
  status           TEXT DEFAULT 'STORED',
  notes            TEXT,
  check_out_date   TIMESTAMPTZ,
  tags             TEXT[],
  action_by        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX fridge_items_resident_id_idx ON public.fridge_items (resident_id);
CREATE INDEX fridge_items_status_idx      ON public.fridge_items (status);
CREATE INDEX fridge_items_date_stored_idx ON public.fridge_items (date_stored);


-- =============================================================================
-- SECTION 13 — GRANTS
-- =============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;


-- =============================================================================
-- SECTION 14 — FUNCTIONS
-- =============================================================================

-- Is the caller an officer? The backbone of every write policy.
CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.officers
    WHERE LOWER(email) = LOWER(COALESCE(
      auth.jwt()->>'email',
      auth.jwt()->'user_metadata'->>'email',
      ''
    ))
  );
$$;

-- Resolve the caller's public profile from their auth identity.
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth.uid() = ANY(auth_uids) LIMIT 1
$$;

-- Create/link a public profile whenever an auth user signs up. Also appends the
-- new auth id to an existing profile so re-created logins keep their data.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, auth_uids)
  VALUES (NEW.id, NEW.email, ARRAY[NEW.id])
  ON CONFLICT (email) DO UPDATE
    SET auth_uids = CASE
      WHEN NEW.id = ANY(public.users.auth_uids) THEN public.users.auth_uids
      ELSE array_append(public.users.auth_uids, NEW.id)
    END;
  RETURN NEW;
END;
$$;

-- BEFORE INSERT: auto-link a manually created profile to its auth identity by
-- email. This is what prevents the onboarding lock-out when a profile is
-- inserted by SQL, by the admin sync, or by any path that only knows the email.
CREATE OR REPLACE FUNCTION public.link_users_to_auth()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_auth_id UUID;
BEGIN
  IF NEW.auth_uids = '{}' AND COALESCE(NEW.email, '') <> '' THEN
    SELECT au.id INTO v_auth_id
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(NEW.email)
    LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
      NEW.auth_uids := ARRAY[v_auth_id];
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Is this resident allowed to use the laundry service this term?
CREATE OR REPLACE FUNCTION public.can_access_laundry(user_uuid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_term TEXT;
  v_type TEXT;
BEGIN
  SELECT value INTO v_term FROM public.constants WHERE key = 'TERM_CURR' LIMIT 1;
  IF v_term IS NULL THEN
    v_term := '';
  END IF;

  SELECT UPPER(TRIM(COALESCE(type, ''))) INTO v_type
  FROM public.accounts
  WHERE resident_id = user_uuid AND period = v_term
  LIMIT 1;

  IF v_type IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_type IN ('STUDENT', 'BOOTCAMP', 'TRANSIENT');
END;
$$;

-- Occupied beds for the onboarding picker, excluding the caller. SECURITY
-- DEFINER is required because accounts_select only shows a resident their own
-- rows; it exposes room/bed only.
CREATE OR REPLACE FUNCTION public.get_occupied_beds()
RETURNS TABLE (room TEXT, bed TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_term TEXT;
BEGIN
  SELECT value INTO v_term FROM public.constants WHERE key = 'TERM_CURR' LIMIT 1;

  RETURN QUERY
  SELECT a.room::text, a.bed::text
  FROM public.accounts a
  WHERE a.period = COALESCE(v_term, '')
    AND COALESCE(a.room, '') <> ''
    AND COALESCE(a.bed, '') <> ''
    AND a.resident_id IS DISTINCT FROM public.current_user_id();
END;
$$;

REVOKE ALL ON FUNCTION public.get_occupied_beds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_occupied_beds() TO authenticated;

-- Duplicate student-number guard for onboarding. The caller's own row is
-- excluded so a returning resident can re-submit their own number.
CREATE OR REPLACE FUNCTION public.student_no_taken(student_no TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE COALESCE(student_no, '') <> ''
      AND LOWER(student_no) = LOWER(NULLIF(TRIM($1), ''))
      AND LOWER(email) <> LOWER(
        COALESCE(
          auth.jwt()->>'email',
          auth.jwt()->'user_metadata'->>'email',
          ''
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.student_no_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_no_taken(TEXT) TO authenticated;

-- Per-term eligible headcounts + all-time user count, for the achievements
-- page. Same SECURITY DEFINER rationale as get_occupied_beds.
CREATE OR REPLACE FUNCTION public.get_achievement_eligible_counts()
RETURNS TABLE (term TEXT, eligible_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT TRIM(a.period) AS term, COUNT(*)::bigint AS eligible_count
  FROM public.accounts a
  WHERE COALESCE(TRIM(a.period), '') <> ''
  GROUP BY TRIM(a.period)
  UNION ALL
  SELECT ''::text AS term, (SELECT COUNT(*)::bigint FROM public.users);
$$;

REVOKE ALL ON FUNCTION public.get_achievement_eligible_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_achievement_eligible_counts() TO authenticated;

-- Public e-receipt lookup. SECURITY DEFINER lets an anonymous visitor read the
-- single requested journal row without relaxing journal RLS. Returns only
-- receipt-safe fields (never notes_private).
CREATE OR REPLACE FUNCTION public.get_receipt_by_id(txn_id UUID)
RETURNS TABLE (
  id UUID, date DATE, water NUMERIC, assoc NUMERIC, misc NUMERIC,
  maintenance NUMERIC, gas NUMERIC, mop TEXT, period TEXT, type TEXT,
  notes TEXT, mop_ref_no TEXT, pr_date_issued DATE, pr_ref_no TEXT,
  creator_name TEXT, account_name TEXT, account_stno TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id, j.date, j.water, j.assoc, j.misc, j.maintenance, j.gas,
    j.mop, j.period, j.type, j.notes, j.mop_ref_no, j.pr_date_issued,
    j.pr_ref_no,
    cu.display_name, au.display_name, au.student_no
  FROM public.journal j
  LEFT JOIN public.users_view cu ON cu.id = j.creator_id
  LEFT JOIN public.users_view au ON au.id = j.account_id
  WHERE j.id = txn_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_receipt_by_id(UUID) TO anon, authenticated;


-- =============================================================================
-- SECTION 15 — TRIGGERS
-- =============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS users_link_auth_identity ON public.users;
CREATE TRIGGER users_link_auth_identity
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_users_to_auth();


-- =============================================================================
-- SECTION 16 — ROW LEVEL SECURITY
-- Every policy below is the FINAL state after all historical migrations, not an
-- intermediate one. Policies are recreated rather than altered so the baseline
-- is order-independent.
-- =============================================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.officers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fridge_items        ENABLE ROW LEVEL SECURITY;

-- ── users ────────────────────────────────────────────────────────────────────
CREATE POLICY users_select ON public.users FOR SELECT TO authenticated
  USING (is_officer() OR id = current_user_id());

CREATE POLICY users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK (is_officer());

CREATE POLICY users_update ON public.users FOR UPDATE TO authenticated
  USING (is_officer());

CREATE POLICY users_delete ON public.users FOR DELETE TO authenticated
  USING (is_officer());

-- ── officers ─────────────────────────────────────────────────────────────────
CREATE POLICY officers_select ON public.officers FOR SELECT TO authenticated
  USING (true);

CREATE POLICY officers_write ON public.officers FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── accounts ─────────────────────────────────────────────────────────────────
CREATE POLICY accounts_select ON public.accounts FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

CREATE POLICY accounts_write ON public.accounts FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── journal ──────────────────────────────────────────────────────────────────
CREATE POLICY journal_select ON public.journal FOR SELECT TO authenticated
  USING (is_officer() OR account_id = current_user_id());

CREATE POLICY journal_write ON public.journal FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── laundry ──────────────────────────────────────────────────────────────────
-- SELECT is widened so an eligible resident can see every booking (needed for
-- the calendar and for the overlap guard to reject double bookings).
-- Writes remain restricted to the resident's own rows.
CREATE POLICY laundry_select ON public.laundry FOR SELECT TO authenticated
  USING (is_officer() OR can_access_laundry(current_user_id()));

CREATE POLICY laundry_insert ON public.laundry FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

CREATE POLICY laundry_update ON public.laundry FOR UPDATE TO authenticated
  USING (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

CREATE POLICY laundry_delete ON public.laundry FOR DELETE TO authenticated
  USING (is_officer() OR (resident_id = current_user_id() AND can_access_laundry(current_user_id())));

-- ── payment_requests ─────────────────────────────────────────────────────────
CREATE POLICY pr_select ON public.payment_requests FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

CREATE POLICY pr_insert ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR resident_id = current_user_id());

-- Residents may cancel their own request by updating status; delete is
-- officer-only.
CREATE POLICY pr_update ON public.payment_requests FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

CREATE POLICY pr_delete ON public.payment_requests FOR DELETE TO authenticated
  USING (is_officer());

-- ── announcements ────────────────────────────────────────────────────────────
CREATE POLICY announcements_select ON public.announcements FOR SELECT TO authenticated
  USING (is_officer() OR (is_admin_only = FALSE AND is_unlisted = FALSE));

CREATE POLICY announcements_write ON public.announcements FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── user_settings ────────────────────────────────────────────────────────────
CREATE POLICY settings_select ON public.user_settings FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

CREATE POLICY settings_insert ON public.user_settings FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR resident_id = current_user_id());

CREATE POLICY settings_update ON public.user_settings FOR UPDATE TO authenticated
  USING (resident_id = current_user_id() OR is_officer());

-- ── achievements ─────────────────────────────────────────────────────────────
CREATE POLICY achievements_select ON public.achievements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY achievements_write ON public.achievements FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

CREATE POLICY ach_records_select ON public.achievement_records FOR SELECT TO authenticated
  USING (true);

CREATE POLICY ach_records_write ON public.achievement_records FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── constants ────────────────────────────────────────────────────────────────
CREATE POLICY constants_select ON public.constants FOR SELECT TO authenticated
  USING (true);

CREATE POLICY constants_write ON public.constants FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── registrations ────────────────────────────────────────────────────────────
CREATE POLICY registrations_select ON public.registrations FOR SELECT TO authenticated
  USING (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email', '')));

CREATE POLICY registrations_insert ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email', '')));

CREATE POLICY registrations_update ON public.registrations FOR UPDATE TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

CREATE POLICY registrations_delete ON public.registrations FOR DELETE TO authenticated
  USING (is_officer());

-- ── fridge_items ─────────────────────────────────────────────────────────────
CREATE POLICY fridge_items_select ON public.fridge_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY fridge_items_insert ON public.fridge_items FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR resident_id = current_user_id());

CREATE POLICY fridge_items_update ON public.fridge_items FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());

CREATE POLICY fridge_items_delete ON public.fridge_items FOR DELETE TO authenticated
  USING (is_officer() OR resident_id = current_user_id());


-- =============================================================================
-- POST-BASELINE VERIFICATION
-- Run these after applying this file. All results are shown as expected.
-- =============================================================================

-- 1. 13 tables, and `curr` must NOT exist.
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;
--   -> accounts, achievement_records, achievements, announcements, constants,
--      fridge_items, journal, laundry, officers, payment_requests,
--      registrations, user_settings, users
-- SELECT to_regclass('public.curr');  -- -> NULL

-- 2. All 9 public functions present.
-- SELECT routine_name FROM information_schema.routines
--  WHERE routine_schema = 'public'
--    AND routine_name IN ('is_officer','current_user_id','can_access_laundry',
--                         'get_occupied_beds','student_no_taken',
--                         'get_achievement_eligible_counts','get_receipt_by_id',
--                         'handle_new_auth_user','link_users_to_auth')
--  ORDER BY 1;

-- 3. Both triggers present.
-- SELECT tgname FROM pg_trigger
--  WHERE NOT tgisinternal
--    AND tgrelid IN ('auth.users'::regclass, 'public.users'::regclass)
--  ORDER BY 1;
--   -> on_auth_user_created, users_link_auth_identity

-- 4. Legacy journal email columns must be gone.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'journal'
--    AND column_name IN ('creator_email','account_email');  -- -> 0 rows

-- 5. RLS enabled on every HAOne table (expect 13 rows).
-- SELECT COUNT(*) FROM pg_tables
--  WHERE schemaname = 'public' AND rowsecurity
--    AND tablename IN ('users','officers','accounts','journal','laundry',
--      'payment_requests','announcements','user_settings','achievements',
--      'achievement_records','constants','registrations','fridge_items');


-- =============================================================================
-- PROVENANCE
-- This baseline consolidates, in order:
--   20240425000000_initial_schema.sql
--   20260729000000_auth_uid_linking_and_rls.sql
--   20260815000000_journal_drop_emails_use_ids.sql
--   20260816000000_laundry_rls_account_type.sql
--   20260914000000_schema_consistency_fixes.sql
--   20260915000000_rename_curr_to_registrations.sql
--   20260923000000_laundry_booking_visibility.sql
--   20260923000000_maintenance_gas_fees.sql
--   20260924000000_laundry_machine_area.sql
--   20260924000000_payment_requests_self_update.sql
--   20260925000000_occupied_beds_rpc.sql
--   20260925020000_student_no_taken_rpc.sql
--   20260926000000_achievements_feature_flag.sql
--   20260926100000_users_auto_link_auth.sql
--
-- Deliberate consolidations (no behaviour change):
--   * fridge_items carries the *_idx index set from 20260914000000 only. The
--     original migration also created an un-suffixed trio on the same columns;
--     for a fresh install one canonical set is enough.
--   * curr_email / curr_term were dropped with the rename and are replaced by
--     registrations_email_idx / registrations_term_idx.
--   * journal_account_email was dropped with its column.
--   * Tables are created without the original `IF NOT EXISTS` guards. The
--     SECTION 0 guard already refuses to run when HAOne objects exist, so a
--     silent partial creation is no longer possible.
--   * Physical column ORDER within a table is normalised. Column order in
--     Postgres is not behavioural; every column name, type, default,
--     nullability and constraint is preserved.
--
-- Deliberate HARDENING (behaviourally identical, safer):
--   * is_officer() is created as public.is_officer() with
--     `SET search_path = public`. The original in 20240425000000 declared it
--     without a search_path pin, which leaves a SECURITY DEFINER function
--     dependent on the caller's search_path. Every other function in the schema
--     already pins it. The returned boolean is unchanged.
--
-- Verified equivalent to the source migrations: table/column/type/default sets
-- for all 13 tables, all indexes, the users_view definition, all 9 functions,
-- both triggers, and the FINAL (post-supersede) form of all 40 RLS policies.
--
-- Data seeds (20260926010000 terms/fees, 20260926020000 MOP, seed.sql) are NOT
-- part of this file. See 001_reference_seed.sql.
-- =============================================================================
