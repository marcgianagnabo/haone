-- 001: HAOne Supabase Initial Schema

-- ============================================================
-- TEARDOWN: Drop all tables and triggers
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS is_officer() CASCADE;
DROP TABLE IF EXISTS fridge_items CASCADE;
DROP TABLE IF EXISTS achievement_records CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS payment_requests CASCADE;
DROP TABLE IF EXISTS laundry CASCADE;
DROP TABLE IF EXISTS journal CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS curr CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS officers CASCADE;
DROP TABLE IF EXISTS constants CASCADE;
DROP VIEW IF EXISTS users_view CASCADE;
DROP TABLE IF EXISTS users CASCADE;
-- ============================================================


-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  last_name TEXT,
  first_name TEXT,
  middle_name TEXT,
  suffix TEXT,
  override_name TEXT,
  student_no TEXT,
  secondary_contact TEXT,
  address TEXT,
  college TEXT,
  degree_program TEXT,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users View (computes display_name and display_name_fl dynamically)
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
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> '' THEN TRIM(override_name)
    ELSE TRIM(CONCAT(
      CASE WHEN last_name IS NOT NULL AND TRIM(last_name) <> '' THEN CONCAT(TRIM(last_name), ', ') ELSE '' END,
      TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(suffix), '')))
    ))
  END AS display_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> '' THEN TRIM(override_name)
    ELSE TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(middle_name), ''), NULLIF(TRIM(last_name), ''), NULLIF(TRIM(suffix), '')))
  END AS display_name_fl,
  student_no,
  secondary_contact,
  address,
  college,
  degree_program,
  tags,
  notes,
  created_at
FROM users;

-- Auto-create a public.users row when a new Supabase Auth user signs in.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Officers Table
CREATE TABLE IF NOT EXISTS officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position TEXT,
  name TEXT,
  nickname TEXT,
  email TEXT NOT NULL,
  fb_link TEXT,
  term TEXT,
  committee TEXT,
  birthday DATE,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id),
  period TEXT,
  room TEXT,
  bed TEXT,
  ce_ref_no TEXT,
  ce_issued DATE,
  ce_link TEXT,
  account_notes TEXT,
  issuer_id UUID REFERENCES users(id),
  check_in_date DATE,
  type TEXT DEFAULT 'STUDENT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Table
CREATE TABLE IF NOT EXISTS journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  creator_email TEXT,
  account_email TEXT,
  water NUMERIC(12, 2) DEFAULT 0,
  assoc NUMERIC(12, 2) DEFAULT 0,
  misc NUMERIC(12, 2) DEFAULT 0,
  mop TEXT,
  period TEXT,
  type TEXT,
  notes TEXT,
  notes_private TEXT,
  mop_ref_no TEXT,
  pr_date_issued DATE,
  pr_ref_no TEXT,
  was_audited BOOLEAN DEFAULT FALSE,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Laundry Table
CREATE TABLE IF NOT EXISTS laundry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id),
  date DATE NOT NULL,
  time_start TEXT NOT NULL,
  time_end TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- Payment Requests Table
CREATE TABLE IF NOT EXISTS payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id),
  date DATE DEFAULT CURRENT_DATE,
  water_fee NUMERIC(12, 2) DEFAULT 0,
  assoc_fee NUMERIC(12, 2) DEFAULT 0,
  misc NUMERIC(12, 2) DEFAULT 0,
  mop TEXT,
  type TEXT,
  proof_link TEXT,
  status TEXT DEFAULT 'PENDING',
  notes TEXT,
  status_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  start_date DATE,
  expiry_date DATE,
  is_indefinite BOOLEAN DEFAULT FALSE,
  is_admin_only BOOLEAN DEFAULT FALSE,
  is_unlisted BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  title TEXT,
  content TEXT,
  slug TEXT UNIQUE,
  broadcast_count INT DEFAULT 0
);

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  resident_id UUID PRIMARY KEY REFERENCES users(id),
  is_public_achievement_list BOOLEAN DEFAULT TRUE,
  resident_nav TEXT,
  admin_nav TEXT,
  density TEXT DEFAULT 'default',
  typography TEXT DEFAULT 'inter',
  theme TEXT DEFAULT 'system',
  is_reduced_motion BOOLEAN DEFAULT FALSE,
  clock_format TEXT DEFAULT '12h',
  calendar_view TEXT DEFAULT 'week'
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  name TEXT,
  description TEXT,
  icon TEXT,
  extra_url TEXT,
  term TEXT,
  points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Achievement Records Table
CREATE TABLE IF NOT EXISTS achievement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recorder_id UUID REFERENCES users(id),
  account_id UUID REFERENCES users(id),
  date DATE DEFAULT CURRENT_DATE,
  achievement_id UUID REFERENCES achievements(id),
  term TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constants Table
CREATE TABLE IF NOT EXISTS constants (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT
);


-- CURR Table (registration/onboarding queue)
CREATE TABLE IF NOT EXISTS curr (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  email TEXT NOT NULL,
  room TEXT,
  bed TEXT,
  program TEXT,
  student_no TEXT,
  check_in_date DATE,
  last_name TEXT,
  first_name TEXT,
  college TEXT,
  evaluated BOOLEAN DEFAULT FALSE,
  term TEXT,
  account_type TEXT DEFAULT 'STUDENT',
  suffix TEXT,
  override_name TEXT,
  decline_reason TEXT
);

-- Fridge Items Table
CREATE TABLE IF NOT EXISTS fridge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compartment TEXT DEFAULT 'REFRIGERATOR',
  location_details TEXT,
  date_stored DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  photo_url TEXT,
  status TEXT DEFAULT 'STORED',
  notes TEXT,
  check_out_date TIMESTAMPTZ,
  tags TEXT[],
  action_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS accounts_resident_id ON accounts (resident_id);
CREATE INDEX IF NOT EXISTS accounts_period ON accounts (period);
CREATE INDEX IF NOT EXISTS journal_account_email ON journal (account_email);
CREATE INDEX IF NOT EXISTS journal_period ON journal (period);
CREATE INDEX IF NOT EXISTS laundry_resident_id ON laundry (resident_id);
CREATE INDEX IF NOT EXISTS payment_requests_resident_id ON payment_requests (resident_id);
CREATE INDEX IF NOT EXISTS achievement_records_account_id ON achievement_records (account_id);
CREATE INDEX IF NOT EXISTS achievement_records_achievement_id ON achievement_records (achievement_id);
CREATE INDEX IF NOT EXISTS curr_email ON curr (email);
CREATE INDEX IF NOT EXISTS curr_term ON curr (term);
CREATE INDEX IF NOT EXISTS fridge_items_resident_id ON fridge_items (resident_id);
CREATE INDEX IF NOT EXISTS fridge_items_status ON fridge_items (status);
CREATE INDEX IF NOT EXISTS fridge_items_date_stored ON fridge_items (date_stored);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE officers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal              ENABLE ROW LEVEL SECURITY;
ALTER TABLE laundry              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE constants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE curr                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items         ENABLE ROW LEVEL SECURITY;

-- Grant table access to API roles
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Helper: is current user an officer?
CREATE OR REPLACE FUNCTION is_officer()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM officers
    WHERE LOWER(email) = LOWER(COALESCE(
      auth.jwt()->>'email',
      ''
    ))
  );
$$;

-- ── users ────────────────────────────────────────────────────
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
  WITH CHECK (is_officer());
CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
  USING (is_officer() OR id = auth.uid());
CREATE POLICY "users_delete" ON users FOR DELETE TO authenticated
  USING (is_officer());

-- ── officers ─────────────────────────────────────────────────
CREATE POLICY "officers_select" ON officers FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "officers_write" ON officers FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── accounts ─────────────────────────────────────────────────
CREATE POLICY "accounts_select" ON accounts FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "accounts_write" ON accounts FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── journal ──────────────────────────────────────────────────
-- NOTE: legacy email-based journal_select is superseded by
-- 20260815000000_journal_drop_emails_use_ids.sql (ID-based RLS) on migrated DBs.
CREATE POLICY "journal_select" ON journal FOR SELECT TO authenticated
  USING (is_officer() OR LOWER(account_email) = LOWER(COALESCE(auth.jwt()->>'email', '')));
CREATE POLICY "journal_write" ON journal FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── laundry ──────────────────────────────────────────────────
CREATE POLICY "laundry_select" ON laundry FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "laundry_insert" ON laundry FOR INSERT TO authenticated
  WITH CHECK (resident_id = auth.uid() OR is_officer());
CREATE POLICY "laundry_update" ON laundry FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "laundry_delete" ON laundry FOR DELETE TO authenticated
  USING (is_officer());

-- ── payment_requests ─────────────────────────────────────────
CREATE POLICY "pr_select" ON payment_requests FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "pr_insert" ON payment_requests FOR INSERT TO authenticated
  WITH CHECK (resident_id = auth.uid() OR is_officer());
CREATE POLICY "pr_update" ON payment_requests FOR UPDATE TO authenticated
  USING (is_officer());
CREATE POLICY "pr_delete" ON payment_requests FOR DELETE TO authenticated
  USING (is_officer());

-- ── announcements ────────────────────────────────────────────
CREATE POLICY "announcements_select" ON announcements FOR SELECT TO authenticated
  USING (is_officer() OR (is_admin_only = FALSE AND is_unlisted = FALSE));
CREATE POLICY "announcements_write" ON announcements FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── user_settings ────────────────────────────────────────────
CREATE POLICY "settings_select" ON user_settings FOR SELECT TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "settings_insert" ON user_settings FOR INSERT TO authenticated
  WITH CHECK (resident_id = auth.uid() OR is_officer());
CREATE POLICY "settings_update" ON user_settings FOR UPDATE TO authenticated
  USING (resident_id = auth.uid() OR is_officer());

-- ── achievements ─────────────────────────────────────────────
CREATE POLICY "achievements_select" ON achievements FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "achievements_write" ON achievements FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── achievement_records ──────────────────────────────────────
CREATE POLICY "ach_records_select" ON achievement_records FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "ach_records_write" ON achievement_records FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── constants ────────────────────────────────────────────────
CREATE POLICY "constants_select" ON constants FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "constants_write" ON constants FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── curr ─────────────────────────────────────────────────────
CREATE POLICY "curr_select" ON curr FOR SELECT TO authenticated
  USING (is_officer() OR LOWER(email) = LOWER(auth.jwt()->>'email'));
CREATE POLICY "curr_write" ON curr FOR ALL TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

-- ── fridge_items ─────────────────────────────────────────────
CREATE POLICY "fridge_items_select" ON fridge_items FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "fridge_items_insert" ON fridge_items FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR resident_id = auth.uid());
CREATE POLICY "fridge_items_update" ON fridge_items FOR UPDATE TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
CREATE POLICY "fridge_items_delete" ON fridge_items FOR DELETE TO authenticated
  USING (is_officer() OR resident_id = auth.uid());
