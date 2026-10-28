ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS inventory_code TEXT;

WITH numbered_qrs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS sequence_number
  FROM qr_codes
)
UPDATE qr_codes
SET inventory_code = 'RT-' || LPAD(
  numbered_qrs.sequence_number::TEXT,
  GREATEST(4, LENGTH(numbered_qrs.sequence_number::TEXT)),
  '0'
)
FROM numbered_qrs
WHERE qr_codes.id = numbered_qrs.id
  AND qr_codes.inventory_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_inventory_code ON qr_codes(inventory_code);

CREATE TABLE IF NOT EXISTS qr_inventory_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);

INSERT INTO qr_inventory_sequence (id, next_value)
SELECT 1, COUNT(*) + 1 FROM qr_codes
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS qr_inventory_batches (
  request_id TEXT PRIMARY KEY,
  qrs_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
