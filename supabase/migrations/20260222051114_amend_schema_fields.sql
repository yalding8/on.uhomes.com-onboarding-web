-- 1. Remove the UPDATE policy for suppliers on contracts table (BDs only edit contracts)
DROP POLICY IF EXISTS "Suppliers can update their own contracts" ON public.contracts;

-- 2. Add missing fields to suppliers table for BD pre-filling process (PRD §3.4)
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS contact_phone text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS country text,
ADD COLUMN IF NOT EXISTS bd_notes text,
ADD COLUMN IF NOT EXISTS bd_user_id uuid;

-- 3. Add missing fields to buildings table for scoring mechanism validation (PRD §4.1.3)
ALTER TABLE public.buildings
ADD COLUMN IF NOT EXISTS postal_code text,
ADD COLUMN IF NOT EXISTS cover_image_url text,
ADD COLUMN IF NOT EXISTS price_min numeric,
ADD COLUMN IF NOT EXISTS price_max numeric,
ADD COLUMN IF NOT EXISTS currency text,
ADD COLUMN IF NOT EXISTS unit_types text[],
ADD COLUMN IF NOT EXISTS key_amenities jsonb DEFAULT '[]'::jsonb;
