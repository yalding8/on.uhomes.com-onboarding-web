-- Supplier follow-up notes table (independent from application_notes)
CREATE TABLE supplier_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_supplier_notes_supplier_id ON supplier_notes(supplier_id);
ALTER TABLE supplier_notes ENABLE ROW LEVEL SECURITY;
