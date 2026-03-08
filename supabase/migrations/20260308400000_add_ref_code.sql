-- Add human-readable reference codes to applications and suppliers
-- Format: APP-0001, SUP-0001 (auto-generated via trigger)

-- 1. Sequences
CREATE SEQUENCE IF NOT EXISTS applications_ref_seq START 1;
CREATE SEQUENCE IF NOT EXISTS suppliers_ref_seq START 1;

-- 2. Add columns
ALTER TABLE applications ADD COLUMN ref_code TEXT UNIQUE;
ALTER TABLE suppliers ADD COLUMN ref_code TEXT UNIQUE;

-- 3. Backfill existing rows (ordered by created_at)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM applications
)
UPDATE applications SET ref_code = 'APP-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered WHERE applications.id = numbered.id;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM suppliers
  WHERE role = 'supplier'
)
UPDATE suppliers SET ref_code = 'SUP-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered WHERE suppliers.id = numbered.id;

-- Reset sequences to max + 1
SELECT setval('applications_ref_seq', COALESCE(
  (SELECT MAX(REPLACE(ref_code, 'APP-', '')::int) FROM applications WHERE ref_code IS NOT NULL), 0
));
SELECT setval('suppliers_ref_seq', COALESCE(
  (SELECT MAX(REPLACE(ref_code, 'SUP-', '')::int) FROM suppliers WHERE ref_code IS NOT NULL AND ref_code LIKE 'SUP-%'), 0
));

-- 4. Trigger functions
CREATE OR REPLACE FUNCTION set_application_ref_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ref_code IS NULL THEN
    NEW.ref_code := 'APP-' || LPAD(nextval('applications_ref_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_supplier_ref_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ref_code IS NULL AND NEW.role = 'supplier' THEN
    NEW.ref_code := 'SUP-' || LPAD(nextval('suppliers_ref_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Triggers
CREATE TRIGGER trg_application_ref_code
  BEFORE INSERT ON applications
  FOR EACH ROW EXECUTE FUNCTION set_application_ref_code();

CREATE TRIGGER trg_supplier_ref_code
  BEFORE INSERT ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_supplier_ref_code();
