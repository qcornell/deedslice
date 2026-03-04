-- API Keys table for REST API access
CREATE TABLE IF NOT EXISTS ds_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_prefix VARCHAR(8) NOT NULL,          -- first 8 chars for display (ds_xxxx...)
  key_hash VARCHAR(128) NOT NULL,          -- SHA-256 hash of the full key
  name VARCHAR(100) DEFAULT 'Default',     -- user label
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by hash
CREATE INDEX idx_api_keys_hash ON ds_api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON ds_api_keys(user_id);

-- RLS
ALTER TABLE ds_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own keys" ON ds_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own keys" ON ds_api_keys FOR DELETE USING (auth.uid() = user_id);

-- Webhooks table
CREATE TABLE IF NOT EXISTS ds_webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',     -- e.g. {'tokenize','transfer','investor_add'}
  secret VARCHAR(64) NOT NULL,             -- HMAC signing secret
  active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user ON ds_webhooks(user_id);

ALTER TABLE ds_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own webhooks" ON ds_webhooks FOR ALL USING (auth.uid() = user_id);

-- KYC status on investors
ALTER TABLE ds_investors ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(20) DEFAULT 'unverified';
-- values: unverified, pending, verified, rejected
ALTER TABLE ds_investors ADD COLUMN IF NOT EXISTS kyc_document_path TEXT;
ALTER TABLE ds_investors ADD COLUMN IF NOT EXISTS kyc_reviewed_at TIMESTAMPTZ;
ALTER TABLE ds_investors ADD COLUMN IF NOT EXISTS kyc_notes TEXT;
