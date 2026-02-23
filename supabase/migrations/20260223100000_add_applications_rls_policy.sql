-- Applications table RLS policy supplement.
-- The table has RLS enabled but no policies, which means:
--   - service_role key (used by /api/apply) bypasses RLS → writes work fine
--   - anon/authenticated keys are blocked by default → no frontend reads possible
--
-- For MVP, applications are managed exclusively via service_role API routes,
-- so we only need a SELECT policy for authenticated BD users in the future.
-- Adding a basic authenticated SELECT policy now to unblock BD dashboard reads.

CREATE POLICY "Authenticated users can view applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (true);

-- Note: INSERT/UPDATE/DELETE remain restricted to service_role only (via API routes).
-- When BD role-based access control is implemented, tighten this SELECT policy
-- to check for a BD role claim, e.g.: USING (auth.jwt() ->> 'role' = 'bd')
