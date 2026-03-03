-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- Creates the ds_documents table for the Document Vault feature

CREATE TABLE IF NOT EXISTS ds_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  label text NOT NULL,
  document_type text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  sha256_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups by property
CREATE INDEX IF NOT EXISTS idx_ds_documents_property_id ON ds_documents(property_id);

-- RLS: allow authenticated users to read documents for properties they own
ALTER TABLE ds_documents ENABLE ROW LEVEL SECURITY;

-- Policy: users can read documents for their own properties
CREATE POLICY "Users can view own property documents"
  ON ds_documents FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM ds_properties WHERE owner_id = auth.uid()
    )
  );

-- Policy: public can view documents for live properties (for investor view)
CREATE POLICY "Public can view documents for live properties"
  ON ds_documents FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM ds_properties WHERE status = 'live'
    )
  );

-- Service role bypasses RLS, so server-side inserts work fine
