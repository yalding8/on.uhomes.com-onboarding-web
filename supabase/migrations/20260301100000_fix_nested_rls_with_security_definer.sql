-- Fix nested RLS issue on building_onboarding_data
--
-- Problem: building_onboarding_data RLS policy JOINs buildings + suppliers,
-- both of which have their own RLS policies. PostgreSQL evaluates RLS
-- recursively, causing the supplier's query to return 0 rows even though
-- each table is individually accessible.
--
-- Solution: Use SECURITY DEFINER helper functions that bypass RLS on the
-- referenced tables while still checking auth.uid(). This is a standard
-- Supabase pattern for multi-table RLS chains.

-- ── Helper: check if current user owns a building (as supplier) ──

CREATE OR REPLACE FUNCTION public.is_building_supplier(p_building_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM buildings b
    JOIN suppliers s ON s.id = b.supplier_id
    WHERE b.id = p_building_id
    AND s.user_id = auth.uid()
    AND s.role = 'supplier'
  );
$$;

-- ── Helper: check if current user is BD or data_team ──

CREATE OR REPLACE FUNCTION public.is_bd_or_data_team()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM suppliers
    WHERE user_id = auth.uid()
    AND role IN ('bd', 'data_team')
  );
$$;

-- ── Recreate building_onboarding_data RLS policies ──

DROP POLICY IF EXISTS "Suppliers can view own building onboarding data"
  ON public.building_onboarding_data;
DROP POLICY IF EXISTS "Suppliers can update own building onboarding data"
  ON public.building_onboarding_data;
DROP POLICY IF EXISTS "BD and Data Team can view all building onboarding data"
  ON public.building_onboarding_data;
DROP POLICY IF EXISTS "BD and Data Team can update all building onboarding data"
  ON public.building_onboarding_data;
DROP POLICY IF EXISTS "BD and Data Team can insert building onboarding data"
  ON public.building_onboarding_data;

CREATE POLICY "Suppliers can view own building onboarding data"
  ON public.building_onboarding_data FOR SELECT TO authenticated
  USING (public.is_building_supplier(building_id));

CREATE POLICY "Suppliers can update own building onboarding data"
  ON public.building_onboarding_data FOR UPDATE TO authenticated
  USING (public.is_building_supplier(building_id));

CREATE POLICY "BD and Data Team can view all building onboarding data"
  ON public.building_onboarding_data FOR SELECT TO authenticated
  USING (public.is_bd_or_data_team());

CREATE POLICY "BD and Data Team can update all building onboarding data"
  ON public.building_onboarding_data FOR UPDATE TO authenticated
  USING (public.is_bd_or_data_team());

CREATE POLICY "BD and Data Team can insert building onboarding data"
  ON public.building_onboarding_data FOR INSERT TO authenticated
  WITH CHECK (public.is_bd_or_data_team());

-- ── Also fix extraction_jobs (same nested RLS issue) ──

DROP POLICY IF EXISTS "Suppliers can view own extraction jobs"
  ON public.extraction_jobs;

CREATE POLICY "Suppliers can view own extraction jobs"
  ON public.extraction_jobs FOR SELECT TO authenticated
  USING (public.is_building_supplier(building_id));

-- ── Also fix field_audit_logs if it has similar policies ──

DROP POLICY IF EXISTS "Suppliers can view own audit logs"
  ON public.field_audit_logs;
DROP POLICY IF EXISTS "BD and Data Team can view all audit logs"
  ON public.field_audit_logs;
DROP POLICY IF EXISTS "BD and Data Team can insert audit logs"
  ON public.field_audit_logs;

CREATE POLICY "Suppliers can view own audit logs"
  ON public.field_audit_logs FOR SELECT TO authenticated
  USING (public.is_building_supplier(building_id));

CREATE POLICY "BD and Data Team can view all audit logs"
  ON public.field_audit_logs FOR SELECT TO authenticated
  USING (public.is_bd_or_data_team());

CREATE POLICY "BD and Data Team can insert audit logs"
  ON public.field_audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_bd_or_data_team());
