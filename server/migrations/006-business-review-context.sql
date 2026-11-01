ALTER TABLE businesses
ADD COLUMN review_category_id TEXT;

ALTER TABLE businesses
ADD COLUMN custom_topics TEXT NOT NULL DEFAULT '[]';
