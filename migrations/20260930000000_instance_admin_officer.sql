-- Instance admin holds officer privilege by default.
--
-- `is_officer()` previously matched only rows in `officers`, so the instance
-- administrator (INSTANCE_ADMIN env) was denied by every RLS policy backed by
-- it unless someone manually inserted an officers row. This adds an additive
-- OR-branch: a login whose email matches the INSTANCE_ADMIN_EMAIL constant
-- also passes. The officers-table path is unchanged, no officers row is
-- created, and elected positions (e.g. President) are untouched.

CREATE OR REPLACE FUNCTION public.is_officer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.officers
    WHERE LOWER(email) = LOWER(COALESCE(
      auth.jwt()->>'email',
      auth.jwt()->'user_metadata'->>'email',
      ''
    ))
  ) OR LOWER(COALESCE(
      auth.jwt()->>'email',
      auth.jwt()->'user_metadata'->>'email',
      ''
    )) = LOWER((SELECT value FROM public.constants WHERE key = 'INSTANCE_ADMIN_EMAIL'));
$$;
