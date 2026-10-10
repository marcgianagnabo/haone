-- 014: Seed academic terms + fees + active term constant
--
-- After a fresh database the `constants` table is empty because terms used to
-- come from the Google Sheets "constants" sheet. In Supabase mode there is no
-- workbook, so the first academic term(s) must be seeded manually (or added
-- via Admin -> Academic Terms -> Add). This file:
--
--   1. Inserts the AY 2026-2027 academic terms (1S, 2S)
--   2. Seeds the fee rows for the active term (ASSOC 200 / WATER 500 /
--      MAINTENANCE 100 / TOTAL 800)
--   3. Sets TERM_CURR so rooms/laundry/register pages work immediately
--
-- Adjust the terms in this file to match your actual academic year.

INSERT INTO public.constants (key, value, description) VALUES
  ('TERM_2627_1S', '2627_1S', 'AY 2026-2027 1st Semester'),
  ('TERM_2627_2S', '2627_2S', 'AY 2026-2027 2nd Semester')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.constants (key, value, description) VALUES
  ('FEES_2627_1S_ASSOC',          '200', 'Fee for 2627_1S (ASSOC)'),
  ('FEES_2627_1S_WATER',          '500', 'Fee for 2627_1S (WATER)'),
  ('FEES_2627_1S_MAINTENANCE',    '100', 'Fee for 2627_1S (MAINTENANCE)'),
  ('FEES_2627_1S_TOTAL',          '800', 'Fee for 2627_1S (TOTAL)'),
  ('FEES_2627_1S_ASSOC_CP',       '0', 'Fee for 2627_1S (ASSOC_CP)'),
  ('FEES_2627_1S_WATER_CP',       '0', 'Fee for 2627_1S (WATER_CP)'),
  ('FEES_2627_1S_MAINTENANCE_CP', '0', 'Fee for 2627_1S (MAINTENANCE_CP)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.constants (key, value, description)
VALUES ('TERM_CURR', '2627_1S', 'Current Term')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;