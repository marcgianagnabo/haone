-- Persist the Gmail profile photo (first-seen) on users so the admin
-- View User card and the resident Profile card can render it.
-- display_name / display_name_fl stay derived, never stored.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE OR REPLACE VIEW users_view WITH (security_invoker = true) AS
SELECT
  id,
  email,
  last_name,
  first_name,
  middle_name,
  suffix,
  override_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> ''
      THEN TRIM(override_name)
    ELSE TRIM(CONCAT(
      CASE
        WHEN last_name IS NOT NULL AND TRIM(last_name) <> ''
          THEN CONCAT(TRIM(last_name), ', ')
        ELSE ''
      END,
      TRIM(CONCAT_WS(' ', NULLIF(TRIM(first_name), ''), NULLIF(TRIM(suffix), '')))
    ))
  END AS display_name,
  CASE
    WHEN override_name IS NOT NULL AND TRIM(override_name) <> ''
      THEN TRIM(override_name)
    ELSE TRIM(CONCAT_WS(' ',
      NULLIF(TRIM(first_name), ''),
      NULLIF(TRIM(middle_name), ''),
      NULLIF(TRIM(last_name), ''),
      NULLIF(TRIM(suffix), '')))
  END AS display_name_fl,
  student_no,
  secondary_contact,
  address,
  college,
  degree_program,
  tags,
  notes,
  created_at,
  avatar_url
FROM public.users;
