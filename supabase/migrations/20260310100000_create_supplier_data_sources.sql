-- P1-G4: Supplier data sources table
-- Allows suppliers to submit Google Sheets, Dropbox, API docs, file uploads

CREATE TABLE supplier_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  building_id UUID REFERENCES buildings(id),
  source_type TEXT NOT NULL CHECK (source_type IN (
    'api_doc', 'google_sheets', 'dropbox', 'file_upload'
  )),
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  api_endpoint TEXT,
  api_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  extraction_job_id UUID REFERENCES extraction_jobs(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE supplier_data_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_own" ON supplier_data_sources
  FOR ALL USING (
    supplier_id IN (SELECT id FROM suppliers WHERE user_id = auth.uid())
  );

CREATE POLICY "service_role_all" ON supplier_data_sources
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_data_sources_supplier ON supplier_data_sources(supplier_id);

-- Extend extraction_jobs.source CHECK for new source types
ALTER TABLE extraction_jobs
  DROP CONSTRAINT IF EXISTS extraction_jobs_source_check;
ALTER TABLE extraction_jobs
  ADD CONSTRAINT extraction_jobs_source_check
  CHECK (source IN (
    'contract_pdf', 'website_crawl', 'google_sheets',
    'file_upload', 'dropbox', 'api_doc'
  ));
