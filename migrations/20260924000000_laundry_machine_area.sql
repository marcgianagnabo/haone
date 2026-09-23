-- Add machine/area per laundry reservation (e.g. Left Wing / Right Wing).
-- Existing bookings default to the first machine (Left Wing).

ALTER TABLE laundry ADD COLUMN IF NOT EXISTS machine TEXT;

UPDATE laundry SET machine = 'LEFT_WING' WHERE machine IS NULL OR machine = '';

ALTER TABLE laundry ALTER COLUMN machine SET DEFAULT 'LEFT_WING';
ALTER TABLE laundry ALTER COLUMN machine SET NOT NULL;