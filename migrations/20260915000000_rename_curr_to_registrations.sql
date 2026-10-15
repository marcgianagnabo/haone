-- 006: Rename curr table to registrations
--
-- 1. Rename table curr -> registrations (or create if neither exists)
-- 2. Rename / update indexes
-- 3. Update RLS policies to registrations_*

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'curr'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'registrations'
  ) THEN
    ALTER TABLE public.curr RENAME TO registrations;
  END IF;
END $$;

-- If starting fresh without curr, ensure registrations exists
CREATE TABLE IF NOT EXISTS public.registrations (
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

-- Ensure decline_reason column exists
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Indexes
DROP INDEX IF EXISTS public.curr_email;
DROP INDEX IF EXISTS public.curr_term;
CREATE INDEX IF NOT EXISTS registrations_email_idx ON public.registrations (email);
CREATE INDEX IF NOT EXISTS registrations_term_idx ON public.registrations (term);

-- RLS
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.registrations TO authenticated;

DROP POLICY IF EXISTS "curr_select" ON public.registrations;
DROP POLICY IF EXISTS "curr_write" ON public.registrations;
DROP POLICY IF EXISTS curr_insert_resident ON public.registrations;
DROP POLICY IF EXISTS "registrations_select" ON public.registrations;
DROP POLICY IF EXISTS "registrations_insert" ON public.registrations;
DROP POLICY IF EXISTS "registrations_update" ON public.registrations;
DROP POLICY IF EXISTS "registrations_delete" ON public.registrations;

CREATE POLICY "registrations_select" ON public.registrations FOR SELECT TO authenticated
  USING (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')));

CREATE POLICY "registrations_insert" ON public.registrations FOR INSERT TO authenticated
  WITH CHECK (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')));

CREATE POLICY "registrations_update" ON public.registrations FOR UPDATE TO authenticated
  USING (is_officer()) WITH CHECK (is_officer());

CREATE POLICY "registrations_delete" ON public.registrations FOR DELETE TO authenticated
  USING (is_officer());
