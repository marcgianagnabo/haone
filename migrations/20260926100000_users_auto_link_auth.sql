-- 015: Auto-link users rows to their Supabase auth identity
--
-- When a `public.users` row is inserted by hand (SQL editor) or by the admin
-- sync ("Approve"), the code it came from does not know the resident's
-- auth.users id, so the profile is created with auth_uids = '{}' and a random
-- id. RLS then resolves current_user_id() to NULL, the resident can't see
-- their own profile/account, isRegistered is false, and they are locked on
-- /onboarding. Residents approved via the Sync page hit the same bug whenever
-- the sign-up trigger did not already create their profile.
--
-- This BEFORE INSERT trigger fills auth_uids from auth.users by email on any
-- insert, which covers every path (UI sync, register flow, manual SQL) and
-- keeps the identity rule from README §6 enforced at the database level.

CREATE OR REPLACE FUNCTION public.link_users_to_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id UUID;
BEGIN
  IF NEW.auth_uids = '{}' AND COALESCE(NEW.email, '') <> '' THEN
    SELECT au.id INTO v_auth_id
    FROM auth.users au
    WHERE LOWER(au.email) = LOWER(NEW.email)
    LIMIT 1;

    IF v_auth_id IS NOT NULL THEN
      NEW.auth_uids := ARRAY[v_auth_id];
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_link_auth_identity ON public.users;
CREATE TRIGGER users_link_auth_identity
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_users_to_auth();

-- Link any profiles that are already unlinked (safe to re-run)
UPDATE public.users u
SET auth_uids = sub.ids
FROM (
  SELECT au.email AS email, ARRAY_AGG(au.id) AS ids
  FROM auth.users au
  GROUP BY au.email
) sub
WHERE LOWER(u.email) = LOWER(sub.email)
  AND u.auth_uids = '{}';