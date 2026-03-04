-- S3.4: Add timezone field to suppliers table
-- Stores IANA timezone identifier (e.g. 'America/New_York', 'Europe/London')
-- Used for: contract date display, SLA calculations, notification scheduling

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

COMMENT ON COLUMN suppliers.timezone IS 'IANA timezone identifier for the supplier. Defaults to UTC. Used for localized date display and notification scheduling.';
