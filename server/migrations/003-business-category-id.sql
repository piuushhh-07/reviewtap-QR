ALTER TABLE businesses
ADD COLUMN category_id TEXT NOT NULL DEFAULT 'other-general-business'
CHECK (
  category_id IN (
    'cafe-restaurant',
    'dental-clinic',
    'pharmacy',
    'salon-barber',
    'gaming-cafe',
    'retail-store',
    'hotel-accommodation',
    'gym-fitness',
    'electronics-computer-store',
    'other-general-business'
  )
);

UPDATE businesses
SET category_id = 'other-general-business';
