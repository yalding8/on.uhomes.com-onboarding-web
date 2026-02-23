-- ============================================================
-- Building Onboarding Portal: Schema Extension
-- ============================================================

-- 1. Extend buildings table: add onboarding_status
ALTER TABLE public.buildings
ADD COLUMN IF NOT EXISTS onboarding_status text
  DEFAULT 'incomplete'
  CHECK (onboarding_status IN (
    'extracting', 'incomplete', 'previewable',
    'ready_to_publish', 'published'
  ));

-- 2. Extend suppliers table: add role for multi-role access control
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS role text
  DEFAULT 'supplier'
  CHECK (role IN ('supplier', 'bd', 'data_team'));

-- ============================================================
-- 3. Building Onboarding Data table
--    Stores all field values as JSONB with source tracking metadata.
--    One row per building (1:1 relationship).
-- ============================================================
CREATE TABLE public.building_onboarding_data (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL UNIQUE,
  field_values jsonb DEFAULT '{}'::jsonb NOT NULL,
  version integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 4. Field Audit Logs table
CREATE TABLE public.field_audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  user_role text NOT NULL,
  field_key text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. Extraction Jobs table
CREATE TABLE public.extraction_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE NOT NULL,
  source text NOT NULL CHECK (source IN ('contract_pdf', 'website_crawl', 'google_sheets')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'timeout')),
  extracted_data jsonb DEFAULT '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ============================================================
-- 6. Enable RLS on all new tables
-- ============================================================
ALTER TABLE public.building_onboarding_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS Policies: building_onboarding_data
-- ============================================================

-- Suppliers can SELECT their own building's onboarding data
CREATE POLICY "Suppliers can view own building onboarding data"
  ON public.building_onboarding_data FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings b
    JOIN public.suppliers s ON s.id = b.supplier_id
    WHERE b.id = building_onboarding_data.building_id
    AND s.user_id = auth.uid()
    AND s.role = 'supplier'
  ));

-- Suppliers can UPDATE their own building's onboarding data
CREATE POLICY "Suppliers can update own building onboarding data"
  ON public.building_onboarding_data FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings b
    JOIN public.suppliers s ON s.id = b.supplier_id
    WHERE b.id = building_onboarding_data.building_id
    AND s.user_id = auth.uid()
    AND s.role = 'supplier'
  ));

-- BD and Data Team can SELECT all onboarding data
CREATE POLICY "BD and Data Team can view all onboarding data"
  ON public.building_onboarding_data FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- BD and Data Team can UPDATE all onboarding data
CREATE POLICY "BD and Data Team can update all onboarding data"
  ON public.building_onboarding_data FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- BD and Data Team can INSERT onboarding data (for extraction pipeline)
CREATE POLICY "BD and Data Team can insert onboarding data"
  ON public.building_onboarding_data FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- ============================================================
-- 8. RLS Policies: field_audit_logs (read-only for authenticated)
-- ============================================================

-- All authenticated users can view audit logs for their accessible buildings
CREATE POLICY "Authenticated users can view audit logs"
  ON public.field_audit_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.buildings b
      JOIN public.suppliers s ON s.id = b.supplier_id
      WHERE b.id = field_audit_logs.building_id
      AND s.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.suppliers
      WHERE suppliers.user_id = auth.uid()
      AND suppliers.role IN ('bd', 'data_team')
    )
  );

-- Insert policy for audit logs (any authenticated user can create logs)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.field_audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 9. RLS Policies: extraction_jobs
-- ============================================================

-- Suppliers can view extraction jobs for their own buildings
CREATE POLICY "Suppliers can view own extraction jobs"
  ON public.extraction_jobs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.buildings b
    JOIN public.suppliers s ON s.id = b.supplier_id
    WHERE b.id = extraction_jobs.building_id
    AND s.user_id = auth.uid()
  ));

-- BD and Data Team can view and manage all extraction jobs
CREATE POLICY "BD and Data Team can view all extraction jobs"
  ON public.extraction_jobs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

CREATE POLICY "BD and Data Team can insert extraction jobs"
  ON public.extraction_jobs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

CREATE POLICY "BD and Data Team can update extraction jobs"
  ON public.extraction_jobs FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- ============================================================
-- 10. RLS: Extend buildings table policies for BD/Data Team
-- ============================================================

-- BD and Data Team can view all buildings
CREATE POLICY "BD and Data Team can view all buildings"
  ON public.buildings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- BD and Data Team can update all buildings
CREATE POLICY "BD and Data Team can update all buildings"
  ON public.buildings FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- BD and Data Team can insert buildings
CREATE POLICY "BD and Data Team can insert buildings"
  ON public.buildings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE suppliers.user_id = auth.uid()
    AND suppliers.role IN ('bd', 'data_team')
  ));

-- ============================================================
-- 11. Triggers: auto-update updated_at
-- ============================================================
CREATE TRIGGER set_building_onboarding_data_updated_at
  BEFORE UPDATE ON public.building_onboarding_data
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
