-- Canonical student number format (XXXX-XXXXX, dash after the 4th digit).
--
-- 1. student_no_taken compares digit-normalized values so dashed and
--    undashed spellings of the same number match. Non-numeric temporary
--    identifiers (TYPE-TERM-uuid) keep exact comparison.
-- 2. Backfill users.student_no / registrations.student_no to the canonical
--    form. Temporary identifiers are untouched.

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

-- Backfill purely numeric student numbers to XXXX-XXXXX.
UPDATE public.users
SET student_no =
  SUBSTRING(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g') FROM 1 FOR 4)
  || '-'
  || SUBSTRING(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g') FROM 5)
WHERE student_no ~ '^[0-9 \-]+$'
  AND LENGTH(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g')) > 4
  AND student_no !~ '^[0-9]{4}-[0-9]+$';

UPDATE public.registrations
SET student_no =
  SUBSTRING(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g') FROM 1 FOR 4)
  || '-'
  || SUBSTRING(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g') FROM 5)
WHERE student_no ~ '^[0-9 \-]+$'
  AND LENGTH(REGEXP_REPLACE(student_no, '[^0-9]', '', 'g')) > 4
  AND student_no !~ '^[0-9]{4}-[0-9]+$';
