ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS review_category_id TEXT;

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS custom_topics TEXT NOT NULL DEFAULT '[]';
