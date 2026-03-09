-- Add deletion_scheduled_at column to suppliers table
-- Used by account-deletion.ts markForDeletion() to persist the 30-day cooling period end date.
-- This column was previously added manually; this migration formalizes it.

ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN suppliers.deletion_scheduled_at IS 'When DELETION_PENDING, the date after which final deletion/anonymization will execute';
