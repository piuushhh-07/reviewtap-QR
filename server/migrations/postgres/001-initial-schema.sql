CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  review_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qr_codes (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unassigned', 'assigned', 'disabled')),
  business_id TEXT REFERENCES businesses(id),
  created_at TEXT NOT NULL,
  assigned_at TEXT,
  CHECK (
    (status IN ('unassigned', 'disabled') AND business_id IS NULL) OR
    (status IN ('assigned', 'disabled') AND business_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  qr_id TEXT,
  business_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS qr_codes_status_created_at ON qr_codes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS qr_codes_business_id ON qr_codes(business_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at ON audit_logs(created_at DESC);
