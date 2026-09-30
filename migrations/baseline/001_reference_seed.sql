-- =============================================================================
-- HAOne — Reference & Configuration Seed
-- =============================================================================
-- RUN AFTER: 000_baseline_schema.sql
--
-- This is the ONLY file that inserts rows. It is deliberately limited to
-- non-operational reference/configuration data:
--
--   INCLUDED (required for the app to initialise)
--     * The two internal system accounts. Their UUIDs are HARDCODED in the
--       application (src/lib/constants.ts -> SYSTEM_IDS), so they are part of
--       the schema contract, not optional data.
--     * The Achievements feature kill switch.
--     * The payment-method (MOP) list, which replaces the old Google Sheets
--       "constants" sheet.
--
--   NOT INCLUDED (must be supplied by the operator — never fabricated)
--     * Academic term codes. Institution-specific; a wrong value silently
--       breaks rooms, laundry, registration and fee lookups.
--     * Fee amounts. These are real financial configuration, not defaults.
--     * Officer / admin accounts. Requires a real person's email address.
--     * Any resident, account, journal, laundry, payment request, fridge item,
--       achievement, announcement or registration row.
--
-- No dummy, placeholder, sample, test or development data appears in this file.
-- A commented-out template is provided in SECTION 4 for academic terms/fees
-- because those values cannot be inferred; SECTION 5 fails loudly until you
-- supply them.
-- =============================================================================


-- =============================================================================
-- SECTION 1 — SYSTEM ACCOUNTS (required)
--
-- These two identities are not "test accounts". They are structural: the
-- journal posts collection/import entries against them, and the Transactions
-- form forces the FUNDS account for funds-only transactions.
--
--   _funds     65eb6240-8200-48dd-a1b9-01c5994c77d7   SYSTEM_IDS.FUNDS
--   _imported  45ee82f7-103f-4607-80b8-6377a76441b7   SYSTEM_IDS.IMPORTED
--
-- Do NOT change these UUIDs. Changing them requires an application code change
-- (src/lib/constants.ts), which is out of scope for a database migration.
--
-- NOTE: SYSTEM_IDS.DUMMY (62383fc4-ce56-407e-adb0-962f0c77a132) is deliberately
-- NOT created here. It was a test fixture in the legacy seed.sql; it is not
-- used by any application code path, and test data must not reach production.
-- =============================================================================
INSERT INTO public.users (id, email, last_name, first_name, created_at) VALUES
  ('65eb6240-8200-48dd-a1b9-01c5994c77d7', '_funds',    '_funds',    '_funds',    NOW()),
  ('45ee82f7-103f-4607-80b8-6377a76441b7', '_imported', '_imported', '_imported', NOW())
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;


-- =============================================================================
-- SECTION 2 — FEATURE KILL SWITCH (safe default: disabled)
-- =============================================================================
INSERT INTO public.constants (key, value, description)
VALUES (
  'FEATURE_ACHIEVEMENTS_ENABLED',
  'FALSE',
  'Kill switch for the Achievements and Leaderboards features (TRUE/FALSE)'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;


-- =============================================================================
-- SECTION 3 — PAYMENT METHODS (MOP) — non-operational reference data
--
-- The Transactions -> Add form and the resident payment-request form read every
-- constant whose key starts with `MOP_`.
--
--   key         = `MOP_<NAME>` (any unique name)
--   value       = exact string stored in `journal.mop`; the financial report
--                 MOP summary groups by this, case-insensitively
--   description = display label. CASH / GCASH / MAYA already have hardcoded
--                 labels in translateMop(); others fall back to this value.
--
-- Add further rows the same way, e.g. ('MOP_BANK', 'BANK', 'Bank Transfer').
-- =============================================================================
INSERT INTO public.constants (key, value, description) VALUES
  ('MOP_CASH',  'CASH',  'Cash'),
  ('MOP_GCASH', 'GCASH', 'G-XCHANGE/GCASH'),
  ('MOP_MAYA',  'MAYA',  'MAYA PHILIPPINES, INC./MAYA WALLET')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, description = EXCLUDED.description;


-- =============================================================================
-- SECTION 4 — ACADEMIC TERMS & FEES (TEMPLATE — EDIT BEFORE USE)
--
-- >>> NOTHING IN THIS SECTION RUNS AS-IS. IT IS FULLY COMMENTED OUT ON
-- >>> PURPOSE. You MUST replace the term code with your institution's real
-- >>> value and uncomment it. There is no safe default: academic-term data
-- >>> must never be fabricated or guessed.
--
-- `TERM_CURR` is load-bearing:
--   * can_access_laundry()  -> decides laundry access; with no current term
--                              every resident is denied.
--   * get_occupied_beds()   -> drives the onboarding room/bed picker.
--   * fee lookups           -> FEES_<TERM>_* power the resident fee views.
--
-- TERM CODE CONVENTION
--   TERM_<AY>_<SEM>   e.g. TERM_2627_1S = AY 2026-2027, 1st Semester
--                      (2627 = 2026-2027 read as 26-27; 1S/2S = semester)
--   The value must match `accounts.period` exactly.
--
-- FEES_<TERM>_<FUND>  ASSOC | WATER | MAINTENANCE | TOTAL
--   the "amount due" for that fund/term, and the corresponding _CP variants
--   (ASSOC_CP / WATER_CP / MAINTENANCE_CP) for the CP/advance component.
--   Set these to your REAL amounts. 0 is only a valid value if the fee
--   genuinely is zero.
--
-- ---------------------------------------------------------------------------
-- TEMPLATE — copy, edit the term code and amounts, then uncomment:
--
-- INSERT INTO public.constants (key, value, description) VALUES
--   ('TERM_<AY>_1S', '<AY>_1S', 'AY <YYYY>-<YYYY> 1st Semester'),
--   ('TERM_<AY>_2S', '<AY>_2S', 'AY <YYYY>-<YYYY> 2nd Semester')
-- ON CONFLICT (key) DO NOTHING;
--
-- INSERT INTO public.constants (key, value, description) VALUES
--   ('FEES_<AY>_1S_ASSOC',          '0', 'Fee for <AY>_1S (ASSOC)'),
--   ('FEES_<AY>_1S_WATER',          '0', 'Fee for <AY>_1S (WATER)'),
--   ('FEES_<AY>_1S_MAINTENANCE',    '0', 'Fee for <AY>_1S (MAINTENANCE)'),
--   ('FEES_<AY>_1S_TOTAL',          '0', 'Fee for <AY>_1S (TOTAL)'),
--   ('FEES_<AY>_1S_ASSOC_CP',       '0', 'Fee for <AY>_1S (ASSOC_CP)'),
--   ('FEES_<AY>_1S_WATER_CP',       '0', 'Fee for <AY>_1S (WATER_CP)'),
--   ('FEES_<AY>_1S_MAINTENANCE_CP', '0', 'Fee for <AY>_1S (MAINTENANCE_CP)')
-- ON CONFLICT (key) DO NOTHING;
--
-- Then set the active term (this one MUST be uncommented and given a real
-- value — replace 'YOUR_TERM_CODE'):
-- INSERT INTO public.constants (key, value, description)
-- VALUES ('TERM_CURR', 'YOUR_TERM_CODE', 'Current Term')
-- ON CONFLICT (key) DO UPDATE
--   SET value = EXCLUDED.value, description = EXCLUDED.description;
-- ---------------------------------------------------------------------------


-- =============================================================================
-- SECTION 5 — FIRST OFFICER / ADMIN ACCOUNT (TEMPLATE — EDIT BEFORE USE)
--
-- `is_officer()` is the backbone of every write policy in the schema. If
-- `officers` contains no row matching a login email, NO authenticated user can
-- create, edit or delete anything. You must therefore add yourself.
--
-- Replace the placeholder with a REAL email address that you will actually log
-- in with. Do not leave a template address in a production database — it is a
-- usable account and a direct data-exposure risk.
--
-- INSERT INTO public.officers (position, name, email, term, committee, status)
-- VALUES ('Admin', 'Your Name', 'you@your-institution.edu', NULL, 'Development', 'ACTIVE');
-- ---------------------------------------------------------------------------


-- =============================================================================
-- SECTION 6 — POST-SEED VERIFICATION
--
-- This raises an EXCEPTION and fails the transaction if the installation is
-- incomplete, so you cannot ship a database with no active term (which would
-- silently deny all laundry access and empty the room/bed picker).
-- =============================================================================
DO $$
DECLARE
  v_term TEXT;
  v_mops INT;
  v_funds INT;
  v_imported INT;
BEGIN
  SELECT value INTO v_term
  FROM public.constants WHERE key = 'TERM_CURR';

  SELECT COUNT(*) INTO v_mops
  FROM public.constants WHERE key LIKE 'MOP_%';

  SELECT COUNT(*) INTO v_funds
  FROM public.users WHERE id = '65eb6240-8200-48dd-a1b9-01c5994c77d7';

  SELECT COUNT(*) INTO v_imported
  FROM public.users WHERE id = '45ee82f7-103f-4607-80b8-6377a76441b7';

  IF v_term IS NULL OR TRIM(v_term) = '' OR v_term = 'YOUR_TERM_CODE' THEN
    RAISE EXCEPTION
      'HAOne seed incomplete: constants.TERM_CURR is not set to a real academic '
      'term (current value: %). Uncomment and edit the SECTION 4 template, then '
      're-run. Do not start the app until this is set — laundry access and the '
      'onboarding room/bed picker both depend on it.', COALESCE(v_term, 'NULL');
  END IF;

  IF v_funds <> 1 THEN
    RAISE EXCEPTION 'HAOne seed incomplete: system account _funds is missing.';
  END IF;

  IF v_imported <> 1 THEN
    RAISE EXCEPTION 'HAOne seed incomplete: system account _imported is missing.';
  END IF;

  IF v_mops = 0 THEN
    RAISE EXCEPTION 'HAOne seed incomplete: no MOP_* payment methods were seeded.';
  END IF;

  RAISE NOTICE 'HAOne seed OK. Active term: %, payment methods: %.', v_term, v_mops;

  IF NOT EXISTS (SELECT 1 FROM public.officers) THEN
    RAISE WARNING
      'HAOne has NO officer accounts. Every write policy requires is_officer(), '
      'so nobody can modify data until you insert yourself into `officers` '
      '(see SECTION 5).';
  END IF;
END;
$$;
