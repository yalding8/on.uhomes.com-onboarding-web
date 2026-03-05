-- Add supplier_type to applications and suppliers tables
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS supplier_type text;

COMMENT ON COLUMN public.applications.supplier_type IS 'Type of supplier: PBSA, PMC, Lettings Agent, Hotel, etc.';

ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS supplier_type text;

COMMENT ON COLUMN public.suppliers.supplier_type IS 'Type of supplier: PBSA, PMC, Lettings Agent, Hotel, etc.';
