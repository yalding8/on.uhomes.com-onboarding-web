-- S2.2: Amenity standardization catalog and building-amenity relationship

CREATE TABLE IF NOT EXISTS amenity_catalog (
  id SERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'building_safety', 'fitness_recreation', 'common_areas',
    'technology', 'parking_transport', 'laundry',
    'outdoor', 'pet', 'accessibility', 'kitchen_dining'
  )),
  icon_name TEXT,
  aliases TEXT[] DEFAULT '{}',
  display_priority SMALLINT DEFAULT 50
);

CREATE TABLE IF NOT EXISTS building_amenities (
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  amenity_id INTEGER REFERENCES amenity_catalog(id),
  source TEXT CHECK (source IN ('manual', 'ai_extract', 'crawl')),
  confidence DECIMAL(3, 2) DEFAULT 1.0,
  PRIMARY KEY (building_id, amenity_id)
);

-- RLS: Same access as buildings table
ALTER TABLE building_amenities ENABLE ROW LEVEL SECURITY;

-- Suppliers can read amenities for their own buildings
CREATE POLICY "Suppliers can read own building amenities"
  ON building_amenities FOR SELECT
  USING (
    building_id IN (
      SELECT id FROM buildings
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE user_id = auth.uid()
      )
    )
  );
