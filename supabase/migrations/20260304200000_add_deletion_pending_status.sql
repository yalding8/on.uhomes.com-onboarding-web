-- S3.1: Support account deletion with cooling period
-- Add DELETION_PENDING to supplier status enum

-- Note: Supabase uses CHECK constraints, not ENUMs.
-- Update the CHECK constraint to include the new status.
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_status_check
  CHECK (status IN ('NEW', 'PENDING_CONTRACT', 'SIGNED', 'DELETION_PENDING'));

-- Add consent tracking table for GDPR compliance
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('cookie', 'privacy_policy', 'terms')),
  consent_version TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_records_user ON consent_records(user_id);

-- RLS: Users can read their own consent records
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own consent records"
  ON consent_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent records"
  ON consent_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);
