-- Officer directory photos + always-public achievement earner names.
--
-- 1. officers.photo_url      — admin-managed override (edited on the officer page).
-- 2. officers.photo_auto_url — Gmail profile photo, auto-filled when the officer
--    signs in (never overwrites photo_url; the app prefers photo_url).
-- 3. get_achievement_earner_names()
--    Privacy toggle is removed from settings, so earner names are always shown.
--    users_select hides other residents' rows, so under Supabase the resident
--    pages could never resolve a display name. This SECURITY DEFINER RPC (same
--    pattern as get_achievement_eligible_counts) safely exposes id + derived
--    display name only — no emails, contacts, or other profile fields.

ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.officers ADD COLUMN IF NOT EXISTS photo_auto_url TEXT;

CREATE OR REPLACE FUNCTION public.get_achievement_earner_names()
RETURNS TABLE (account_id UUID, display_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id AS account_id,
    CASE
      WHEN u.override_name IS NOT NULL AND TRIM(u.override_name) <> ''
        THEN TRIM(u.override_name)
      ELSE TRIM(CONCAT(
        CASE
          WHEN u.last_name IS NOT NULL AND TRIM(u.last_name) <> ''
            THEN CONCAT(TRIM(u.last_name), ', ')
          ELSE ''
        END,
        TRIM(CONCAT_WS(' ', NULLIF(TRIM(u.first_name), ''), NULLIF(TRIM(u.suffix), '')))
      ))
    END AS display_name
  FROM public.users u;
$$;

REVOKE ALL ON FUNCTION public.get_achievement_earner_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_achievement_earner_names() TO authenticated;
