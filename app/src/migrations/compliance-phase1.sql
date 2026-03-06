-- ============================================================
-- DeedSlice Phase 1: Compliance Infrastructure
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. Add accreditation fields to ds_investors ─────────────
ALTER TABLE ds_investors
  ADD COLUMN IF NOT EXISTS accreditation_status text DEFAULT 'none'
    CHECK (accreditation_status IN ('none', 'pending', 'verified', 'rejected', 'expired')),
  ADD COLUMN IF NOT EXISTS accreditation_method text DEFAULT NULL
    CHECK (accreditation_method IS NULL OR accreditation_method IN ('self_attested', 'document_upload', 'third_party', 'manual_override')),
  ADD COLUMN IF NOT EXISTS accreditation_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accreditation_verified_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accreditation_expiry timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accreditation_notes text DEFAULT NULL;

-- ── 2. Add offering compliance settings to ds_properties ────
ALTER TABLE ds_properties
  ADD COLUMN IF NOT EXISTS offering_type text DEFAULT 'private'
    CHECK (offering_type IN ('506b', '506c', 'regs', 'private', 'test')),
  ADD COLUMN IF NOT EXISTS requires_accreditation boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_kyc boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS transfer_restricted boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS issuer_certified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS issuer_certified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS issuer_certified_ip text DEFAULT NULL;

-- ── 3. Per-token investor permissions ───────────────────────
-- Tracks KYC grant/revoke and freeze status per investor per token.
-- This maps to on-chain HTS KYC Key and Freeze Key operations.
CREATE TABLE IF NOT EXISTS ds_token_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_id uuid NOT NULL REFERENCES ds_investors(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  token_id text NOT NULL,              -- Hedera Token ID (share token)
  wallet_address text NOT NULL,        -- Hedera account ID
  kyc_status text DEFAULT 'pending'
    CHECK (kyc_status IN ('pending', 'granted', 'revoked')),
  freeze_status text DEFAULT 'unfrozen'
    CHECK (freeze_status IN ('frozen', 'unfrozen')),
  accreditation_required boolean DEFAULT false,
  approved_by uuid DEFAULT NULL,       -- operator who approved
  approved_at timestamptz DEFAULT NULL,
  kyc_grant_tx_id text DEFAULT NULL,   -- Hedera tx for TokenGrantKyc
  kyc_revoke_tx_id text DEFAULT NULL,  -- Hedera tx for TokenRevokeKyc
  freeze_tx_id text DEFAULT NULL,      -- Hedera tx for TokenFreeze
  unfreeze_tx_id text DEFAULT NULL,    -- Hedera tx for TokenUnfreeze
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(investor_id, token_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_permissions_token ON ds_token_permissions(token_id);
CREATE INDEX IF NOT EXISTS idx_token_permissions_investor ON ds_token_permissions(investor_id);
CREATE INDEX IF NOT EXISTS idx_token_permissions_wallet ON ds_token_permissions(wallet_address);

-- ── 4. Issuer certification log ─────────────────────────────
-- Immutable record of every time an operator certified compliance.
-- This is the legal "CYA" receipt.
CREATE TABLE IF NOT EXISTS ds_issuer_certifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  certified_at timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  certification_text text NOT NULL,    -- exact text they agreed to
  checkboxes_checked jsonb NOT NULL,   -- which boxes they ticked
  UNIQUE(property_id)                  -- one certification per property (can be re-certified)
);

-- ── 5. RLS Policies ─────────────────────────────────────────

-- Token permissions: operators can see their own properties' permissions
ALTER TABLE ds_token_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can manage token permissions for their properties"
  ON ds_token_permissions
  FOR ALL
  USING (
    property_id IN (
      SELECT id FROM ds_properties WHERE owner_id = auth.uid()
    )
  );

-- Issuer certifications: operators can see their own
ALTER TABLE ds_issuer_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view their certifications"
  ON ds_issuer_certifications
  FOR ALL
  USING (user_id = auth.uid());

-- ── 6. Updated timestamp trigger for token_permissions ──────
CREATE OR REPLACE FUNCTION update_token_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_token_permissions_updated_at
  BEFORE UPDATE ON ds_token_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_token_permissions_updated_at();
