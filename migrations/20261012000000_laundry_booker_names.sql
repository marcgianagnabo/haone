-- Resident-visible laundry booker names + rooms (admin view unchanged).
--
-- Residents cannot read other users' rows (users_select) or rooms
-- (accounts_select), so the resident calendar falls back to "Resident" for
-- every slot that is not their own. This SECURITY DEFINER RPC (same pattern
-- as get_achievement_earner_names) safely exposes resident_id + display name
-- + active-term room only — no emails, contacts, or other profile fields.
-- TRANSIENT callers stay masked: the function returns no rows for them
-- (mirrors canSeeLaundryNames in the app).

CREATE OR REPLACE FUNCTION public.get_laundry_booker_names()
RETURNS TABLE (resident_id UUID, display_name TEXT, room TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID;
  v_term TEXT;
  v_type TEXT;
BEGIN
  v_me := public.current_user_id();
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO v_term FROM public.constants WHERE key = 'TERM_CURR' LIMIT 1;

  SELECT UPPER(TRIM(COALESCE(a.type, ''))) INTO v_type
  FROM public.accounts a
  WHERE a.resident_id = v_me AND a.period = COALESCE(v_term, '')
  LIMIT 1;

  -- TRANSIENT accounts cannot see other residents' names.
  IF COALESCE(v_type, '') = 'TRANSIENT' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    u.id AS resident_id,
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
    END AS display_name,
    COALESCE(a.room, '') AS room
  FROM public.users u
  JOIN public.laundry l ON l.resident_id = u.id
  LEFT JOIN public.accounts a
    ON a.resident_id = u.id AND a.period = COALESCE(v_term, '')
  ORDER BY 2, 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_laundry_booker_names() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_laundry_booker_names() TO authenticated;
