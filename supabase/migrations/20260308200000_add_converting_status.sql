-- Add CONVERTING to applications status CHECK constraint.
-- The approve-supplier endpoint uses CONVERTING as an intermediate state
-- to prevent race conditions during the approval workflow.
ALTER TABLE applications DROP CONSTRAINT applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('PENDING', 'CONVERTING', 'CONVERTED', 'REJECTED'));
