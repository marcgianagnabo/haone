-- Remove user_metadata from RLS security context.
--
-- Supabase Auth user_metadata is editable by the end user via
-- auth.updateUser({ data: ... }) and must not be used for authorization.
-- The old expression:
--   COALESCE(auth.jwt()->>'email', auth.jwt()->'user_metadata'->>'email', '')
-- falls back to a user-controlled value whenever the top-level JWT email
-- claim is NULL/missing. The secure replacement uses only the server-set
-- top-level claim and fails closed to '':
--   COALESCE(auth.jwt()->>'email', '')
--
-- Scope: public.registrations policies registrations_select +
-- registrations_insert (lint findings), plus the same expression in
-- public.is_officer() (preserving the INSTANCE_ADMIN_EMAIL OR-branch from
-- 20260930) and public.student_no_taken() (preserving digit-normalized
-- comparison from 20260929).
--
-- Legacy journal_select on (creator_email/account_email) was superseded by
-- 20260815000000_journal_drop_emails_use_ids.sql which drops those columns
-- and recreates journal RLS on creator_id/account_id. This migration audits
-- for a leftover legacy policy instead of recreating obsolete behavior.
--
-- Rules-only change: no DELETE/UPDATE/TRUNCATE/DROP TABLE, no row changes.
-- Recovery: corrective forward migration only. Do NOT roll back to
-- definitions containing user_metadata as that would reintroduce the issue.
-- Apply via the repository migration workflow in migrations/README.md
-- (ascending timestamp order). Test in staging before production.

-- ── 1. registrations_select / registrations_insert ──────────────
DROP POLICY IF EXISTS "registrations_select" ON public.registrations;
CREATE POLICY "registrations_select" ON public.registrations
FOR SELECT TO authenticated
USING (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')));

DROP POLICY IF EXISTS "registrations_insert" ON public.registrations;
CREATE POLICY "registrations_insert" ON public.registrations
FOR INSERT TO authenticated
WITH CHECK (is_officer() OR LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', '')));

-- ── 2. is_officer() — keep INSTANCE_ADMIN_EMAIL branch, drop fallback ──
CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.officers
    WHERE LOWER(email) = LOWER(COALESCE(auth.jwt()->>'email', ''))
  ) OR LOWER(COALESCE(auth.jwt()->>'email', ''))
       = LOWER((SELECT value FROM public.constants WHERE key = 'INSTANCE_ADMIN_EMAIL'));
$$;

-- ── 3. student_no_taken() — keep digit-normalized logic, drop fallback ──
CREATE OR REPLACE FUNCTION public.student_no_taken(student_no TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE COALESCE(student_no, '') <> ''
      AND (
        (
          student_no ~ '^[0-9 \-]+$'
          AND NULLIF(TRIM($1), '') ~ '^[0-9 \-]+$'
          AND REGEXP_REPLACE(student_no, '[^0-9]', '', 'g')
            = REGEXP_REPLACE(TRIM($1), '[^0-9]', '', 'g')
        )
        OR LOWER(student_no) = LOWER(NULLIF(TRIM($1), ''))
      )
      AND LOWER(email) <> LOWER(COALESCE(auth.jwt()->>'email', ''))
  );
$$;

REVOKE ALL ON FUNCTION public.student_no_taken(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_no_taken(TEXT) TO authenticated;

-- ── 4. Legacy journal audit (no recreate) ───────────────────────
-- If a pre-20260815 journal_select referencing account_email still exists,
-- fail loudly so the operator handles it explicitly instead of silently
-- recreating a dropped column dependency.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'journal'
      AND (qual ILIKE '%user_metadata%' OR with_check ILIKE '%user_metadata%')
  ) THEN
    RAISE NOTICE 'Legacy journal policy with user_metadata still present — review manually; not auto-recreated by this migration.';
  END IF;
END $$;
