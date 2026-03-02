-- DeedSlice Database Schema (ds_ prefixed — safe to run alongside HashClout)
-- Run this in your Supabase SQL editor

-- ─── Profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ds_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_name TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  properties_used INTEGER NOT NULL DEFAULT 0,
  properties_limit INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Properties ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ds_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES ds_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  property_type TEXT NOT NULL DEFAULT 'residential' CHECK (property_type IN ('residential', 'commercial', 'land', 'industrial', 'mixed')),
  valuation_usd NUMERIC NOT NULL,
  total_slices INTEGER NOT NULL,
  description TEXT,
  image_url TEXT,
  -- On-chain references
  nft_token_id TEXT,
  nft_serial INTEGER,
  share_token_id TEXT,
  share_token_symbol TEXT,
  audit_topic_id TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'deploying', 'live', 'failed')),
  network TEXT NOT NULL DEFAULT 'testnet' CHECK (network IN ('testnet', 'mainnet')),
  deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Investors ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ds_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  wallet_address TEXT,
  slices_owned INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Audit Entries ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ds_audit_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  tx_id TEXT,
  hcs_sequence INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ds_properties_owner ON ds_properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_ds_investors_property ON ds_investors(property_id);
CREATE INDEX IF NOT EXISTS idx_ds_audit_property ON ds_audit_entries(property_id);

-- ─── RLS Policies ────────────────────────────────────────
ALTER TABLE ds_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ds_audit_entries ENABLE ROW LEVEL SECURITY;

-- ds_profiles
CREATE POLICY "ds_profiles_select_own" ON ds_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "ds_profiles_update_own" ON ds_profiles FOR UPDATE USING (auth.uid() = id);

-- ds_properties
CREATE POLICY "ds_properties_select_own" ON ds_properties FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "ds_properties_insert_own" ON ds_properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "ds_properties_update_own" ON ds_properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "ds_properties_delete_own" ON ds_properties FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "ds_properties_select_live" ON ds_properties FOR SELECT USING (status = 'live');

-- ds_investors
CREATE POLICY "ds_investors_owner_all" ON ds_investors FOR ALL USING (
  EXISTS (SELECT 1 FROM ds_properties WHERE ds_properties.id = ds_investors.property_id AND ds_properties.owner_id = auth.uid())
);
CREATE POLICY "ds_investors_public_live" ON ds_investors FOR SELECT USING (
  EXISTS (SELECT 1 FROM ds_properties WHERE ds_properties.id = ds_investors.property_id AND ds_properties.status = 'live')
);

-- ds_audit_entries
CREATE POLICY "ds_audit_insert_owner" ON ds_audit_entries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ds_properties WHERE ds_properties.id = ds_audit_entries.property_id AND ds_properties.owner_id = auth.uid())
);
CREATE POLICY "ds_audit_select_live" ON ds_audit_entries FOR SELECT USING (
  EXISTS (SELECT 1 FROM ds_properties WHERE ds_properties.id = ds_audit_entries.property_id AND ds_properties.status = 'live')
);

-- ─── Auto-update trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION ds_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ds_profiles_updated_at BEFORE UPDATE ON ds_profiles FOR EACH ROW EXECUTE FUNCTION ds_update_updated_at();
CREATE TRIGGER ds_properties_updated_at BEFORE UPDATE ON ds_properties FOR EACH ROW EXECUTE FUNCTION ds_update_updated_at();

-- ─── Auto-create profile on signup ──────────────────────
CREATE OR REPLACE FUNCTION ds_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ds_profiles (id, email, plan, properties_used, properties_limit)
  VALUES (NEW.id, NEW.email, 'starter', 0, 1)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to avoid conflict with HashClout's trigger
DROP TRIGGER IF EXISTS ds_on_auth_user_created ON auth.users;
CREATE TRIGGER ds_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION ds_handle_new_user();
