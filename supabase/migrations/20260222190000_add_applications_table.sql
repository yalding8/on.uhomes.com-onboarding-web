-- Applications staging table: stores pre-auth supplier inquiries submitted via Landing Page.
-- This decouples the public "apply" flow from the auth-gated "suppliers" table.
-- BD team reviews applications here and triggers approval via /api/admin/approve-supplier.

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  city text,
  country text,
  website_url text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONVERTED', 'REJECTED')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_applications_updated_at
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
