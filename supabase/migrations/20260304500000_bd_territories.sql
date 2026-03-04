-- S4.2: BD Territory assignment table
CREATE TABLE IF NOT EXISTS bd_territories (
  id SERIAL PRIMARY KEY,
  bd_user_id UUID NOT NULL REFERENCES auth.users(id),
  country_code CHAR(2),
  city TEXT, -- NULL = full country coverage
  max_active_suppliers SMALLINT DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  priority SMALLINT DEFAULT 0 CHECK (priority IN (-1, 0, 1)),
  referral_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bd_territories_country ON bd_territories(country_code);
CREATE INDEX idx_bd_territories_referral ON bd_territories(referral_code)
  WHERE referral_code IS NOT NULL;

-- RLS: Only admin users can read/write BD territories
ALTER TABLE bd_territories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage BD territories"
  ON bd_territories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "BD can read own territories"
  ON bd_territories FOR SELECT
  USING (bd_user_id = auth.uid());
