-- Create suppliers table
CREATE TABLE public.suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'PENDING_CONTRACT', 'SIGNED')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view their own data"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Suppliers can update their own data"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- Create contracts table
CREATE TABLE public.contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SENT', 'SIGNED', 'CANCELED')),
  document_url text,
  signed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for contracts
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view their own contracts"
  ON public.contracts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.id = contracts.supplier_id
    AND suppliers.user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can update their own contracts"
  ON public.contracts FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.id = contracts.supplier_id
    AND suppliers.user_id = auth.uid()
  ));


-- Create buildings (properties) table
CREATE TABLE public.buildings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE NOT NULL,
  building_name text NOT NULL,
  building_address text NOT NULL,
  city text,
  country text,
  score integer DEFAULT 0,
  data_sources jsonb DEFAULT '{}'::jsonb,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for buildings
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suppliers can view their own buildings"
  ON public.buildings FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.id = buildings.supplier_id
    AND suppliers.user_id = auth.uid()
  ));

CREATE POLICY "Suppliers can update their own buildings"
  ON public.buildings FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.id = buildings.supplier_id
    AND suppliers.user_id = auth.uid()
  ));


-- Function to auto-update the updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER set_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_buildings_updated_at
BEFORE UPDATE ON public.buildings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
