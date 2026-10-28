ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
CHECK (category IN ('cafe', 'pharmacy', 'dental', 'clinic', 'salon', 'hotel', 'retail', 'other'));
