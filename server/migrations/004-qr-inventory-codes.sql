ALTER TABLE qr_codes ADD COLUMN inventory_code TEXT;

WITH numbered_qrs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS sequence_number
  FROM qr_codes
)
UPDATE qr_codes
SET inventory_code = (
  SELECT 'RT-' || printf('%04d', numbered_qrs.sequence_number)
  FROM numbered_qrs
  WHERE numbered_qrs.id = qr_codes.id
);

CREATE UNIQUE INDEX qr_codes_inventory_code ON qr_codes(inventory_code);

CREATE TABLE qr_inventory_sequence (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_value INTEGER NOT NULL
);

INSERT INTO qr_inventory_sequence (id, next_value)
SELECT 1, COUNT(*) + 1 FROM qr_codes;

CREATE TABLE qr_inventory_batches (
  request_id TEXT PRIMARY KEY,
  qrs_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
