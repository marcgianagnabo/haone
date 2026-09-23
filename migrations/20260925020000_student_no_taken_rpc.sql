-- 009: Duplicate student number guard for onboarding
--
-- accounts_select only shows a resident their own records, so a SECURITY
-- DEFINER RPC is required for the onboarding form to detect that a student
-- number already belongs to an existing user (someone already "inside").
--
-- The caller's own row (matched by JWT email) is excluded so a returning
-- resident can re-submit with their own student number without being blocked.

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