-- 021: Additional payment channels (GoTyMe, MariBank)
--
-- Payment methods are data, not schema: `journal.mop` is plain TEXT with no
-- CHECK constraint, so adding a channel is just a row in `constants`. Every
-- surface that lists channels reads the constants whose key starts with `MOP_`
-- (fetchMopTypes(), the Add Transaction combobox, the resident payment-request
-- form, and the financial report's MOP summary).
--
-- Conventions (same as 20260926020000_mop_types_seed.sql):
--   key         = `MOP_<NAME>`
--   value       = exact string stored in `journal.mop`; the financial report
--                 groups by this, case-insensitively. `value` is the persisted
--                 identifier and must stay stable — renaming it would orphan
--                 existing journal rows.
--   description = display label, surfaced in the resident-facing dropdowns.
--                 Follow the uppercase convention of G-XCHANGE/GCASH and
--                 MAYA PHILIPPINES, INC./MAYA WALLET.

INSERT INTO public.constants (key, value, description) VALUES
  ('MOP_GOTYME',   'GOTYME',   'GOTYME BANK'),
  ('MOP_MARIBANK', 'MARIBANK', 'MARIBANK')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;