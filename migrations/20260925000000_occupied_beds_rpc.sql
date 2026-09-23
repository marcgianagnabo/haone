-- 007: Occupied beds for onboarding (RLS-safe)
--
-- accounts_select only lets a resident see their own account rows, so the
-- onboarding bed picker could never see other residents' occupied beds under
-- Supabase. SECURITY DEFINER runs as the function owner (bypasses RLS) but
-- only exposes room/bed, excluding the caller.

CREATE OR REPLACE FUNCTION public.get_occupied_beds()
RETURNS TABLE (room TEXT, bed TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND a.resident_id IS DISTINCT FROM current_user_id();
END;
$$;

REVOKE ALL ON FUNCTION public.get_occupied_beds() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_occupied_beds() TO authenticated;