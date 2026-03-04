-- S4.4: Supplier trust badges
CREATE TABLE IF NOT EXISTS supplier_badges (
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  badge_type TEXT NOT NULL CHECK (badge_type IN (
    'verified_identity', 'verified_property', 'fast_responder',
    'high_quality', 'uhomes_guaranteed', 'top_partner'
  )),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- NULL = never expires
  PRIMARY KEY (supplier_id, badge_type)
);

-- RLS: Suppliers can read own badges, admin can manage all
ALTER TABLE supplier_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can read own badges"
  ON supplier_badges FOR SELECT
  USING (
    supplier_id IN (
      SELECT id FROM suppliers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admin can manage badges"
  ON supplier_badges FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
