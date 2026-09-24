-- 016: Seed payment methods (MOP_*) constants
--
-- Payment methods used to come from the Google Sheets "constants" sheet. In
-- Supabase mode there is no workbook, so the MOP list must be seeded manually.
-- The Transactions -> Add form and the resident payment-request form read every
-- constant whose key starts with `MOP_`.
--
-- Conventions:
--   * key        = `MOP_<NAME>` (any unique name)
--   * value      = the exact string stored in `journal.mop` (this is what the
--                  financial report MOP summary groups by, case-insensitively)
--   * description= display label; CASH / GCASH / MAYA already have pretty
--                  labels in `translateMop`, everything else shows its
--                  description (or raw value) unless you set one.
--
-- Add more rows the same way, e.g. ('MOP_BANK', 'BANK', 'Bank Transfer').

INSERT INTO public.constants (key, value, description) VALUES
  ('MOP_CASH',  'CASH',  'Cash'),
  ('MOP_GCASH', 'GCASH', 'G-XCHANGE/GCASH'),
  ('MOP_MAYA',  'MAYA',  'MAYA PHILIPPINES, INC./MAYA WALLET')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;