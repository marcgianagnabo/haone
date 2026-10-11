-- Collection (Others) is misc-only: dorm fees (water/assoc/maintenance/gas)
-- always belong to COLLECTION. This backstops the app-side split rule so a
-- mixed single row (the phantom-UHO cause) is rejected even if the app is
-- bypassed. Run manually in Supabase SQL Editor as postgres (see README §4).
--
-- Pre-verify (expect zero rows before applying):
-- SELECT id FROM journal WHERE type = 'COLLECTION_OTHERS'
--   AND (COALESCE(water, 0) <> 0 OR COALESCE(assoc, 0) <> 0
--     OR COALESCE(maintenance, 0) <> 0 OR COALESCE(gas, 0) <> 0);
-- SELECT id FROM payment_requests WHERE type = 'COLLECTION_OTHERS'
--   AND (COALESCE(water_fee, 0) <> 0 OR COALESCE(assoc_fee, 0) <> 0
--     OR COALESCE(maintenance_fee, 0) <> 0 OR COALESCE(gas_fee, 0) <> 0);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journal_others_misc_only') THEN
    ALTER TABLE journal ADD CONSTRAINT journal_others_misc_only CHECK (
      type <> 'COLLECTION_OTHERS' OR (
        COALESCE(water, 0) = 0 AND COALESCE(assoc, 0) = 0 AND
        COALESCE(maintenance, 0) = 0 AND COALESCE(gas, 0) = 0
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_others_misc_only') THEN
    ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_others_misc_only CHECK (
      type <> 'COLLECTION_OTHERS' OR (
        COALESCE(water_fee, 0) = 0 AND COALESCE(assoc_fee, 0) = 0 AND
        COALESCE(maintenance_fee, 0) = 0 AND COALESCE(gas_fee, 0) = 0
      )
    );
  END IF;
END $$;
