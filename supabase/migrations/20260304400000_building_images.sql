-- S1.1: Building images table (replaces JSONB image field)
CREATE TABLE IF NOT EXISTS building_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'exterior', 'lobby', 'bedroom', 'bathroom',
    'kitchen', 'living_area', 'amenities', 'neighborhood', 'floor_plan'
  )),
  quality_score SMALLINT DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  width INTEGER,
  height INTEGER,
  file_size_kb INTEGER,
  is_primary BOOLEAN DEFAULT false,
  sort_order SMALLINT DEFAULT 0,
  source TEXT CHECK (source IN ('upload', 'crawl', 'ai_generated')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_building_images_building ON building_images(building_id);

-- RLS: Same access as buildings table
ALTER TABLE building_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can read own building images"
  ON building_images FOR SELECT
  USING (
    building_id IN (
      SELECT id FROM buildings
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Suppliers can insert own building images"
  ON building_images FOR INSERT
  WITH CHECK (
    building_id IN (
      SELECT id FROM buildings
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Suppliers can update own building images"
  ON building_images FOR UPDATE
  USING (
    building_id IN (
      SELECT id FROM buildings
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Suppliers can delete own building images"
  ON building_images FOR DELETE
  USING (
    building_id IN (
      SELECT id FROM buildings
      WHERE supplier_id IN (
        SELECT id FROM suppliers WHERE user_id = auth.uid()
      )
    )
  );
