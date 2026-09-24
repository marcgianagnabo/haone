-- 010: Achievements: eligible-count RPC + feature kill switch
--
-- 1. get_achievement_eligible_counts()
--    accounts_select only lets a resident see their OWN account rows, so under
--    Supabase the achievements page could never compute the "X% of residents"
--    stat the Google Sheets /api/resident/achievements endpoint used to derive
--    from the full accounts list. This SECURITY DEFINER RPC (same pattern as
--    get_occupied_beds / student_no_taken) safely exposes aggregate headcounts:
--      * one row per accounts.period  -> resident count for that term
--      * a row with term = ''         -> total user count (all-time achievements)
--
-- 2. FEATURE_ACHIEVEMENTS_ENABLED
--    Kill switch (defaults to disabled) that hides the Achievements and
--    Leaderboards features from navigation/sight. Flip back to TRUE to re-enable.

CREATE OR REPLACE FUNCTION public.get_achievement_eligible_counts()
RETURNS TABLE (term TEXT, eligible_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRIM(a.period) AS term, COUNT(*)::bigint AS eligible_count
  FROM public.accounts a
  WHERE COALESCE(TRIM(a.period), '') <> ''
  GROUP BY TRIM(a.period)
  UNION ALL
  SELECT ''::text AS term, (SELECT COUNT(*)::bigint FROM public.users);
$$;

REVOKE ALL ON FUNCTION public.get_achievement_eligible_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_achievement_eligible_counts() TO authenticated;

INSERT INTO public.constants (key, value, description)
VALUES (
  'FEATURE_ACHIEVEMENTS_ENABLED',
  'FALSE',
  'Kill switch for the Achievements and Leaderboards features (TRUE/FALSE)'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;