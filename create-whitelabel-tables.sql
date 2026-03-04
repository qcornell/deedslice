-- ============================================================
-- WHITE-LABEL + LP PORTAL — Database Schema
-- ============================================================

-- 1. Organizations (tenants)
CREATE TABLE IF NOT EXISTS ds_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,              -- subdomain / URL identifier
  custom_domain VARCHAR(255),                      -- e.g. invest.clientname.com
  domain_verified BOOLEAN DEFAULT FALSE,
  domain_verification_token VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_org_slug ON ds_organizations(slug);
CREATE UNIQUE INDEX idx_org_domain ON ds_organizations(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_org_owner ON ds_organizations(owner_id);

ALTER TABLE ds_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own orgs" ON ds_organizations FOR ALL USING (auth.uid() = owner_id);

-- 2. Organization branding
CREATE TABLE IF NOT EXISTS ds_org_branding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES ds_organizations(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  favicon_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#0D9488',     -- hex
  secondary_color VARCHAR(7) DEFAULT '#0F172A',
  accent_color VARCHAR(7) DEFAULT '#6366F1',
  text_color VARCHAR(7) DEFAULT '#0F172A',
  bg_color VARCHAR(7) DEFAULT '#F8FAFC',
  email_sender_name VARCHAR(100),                  -- "Smith Capital" instead of "DeedSlice"
  portal_title VARCHAR(200),                       -- "Smith Capital Investor Portal"
  footer_text VARCHAR(200) DEFAULT 'Powered by DeedSlice',
  show_powered_by BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_branding_org ON ds_org_branding(org_id);

ALTER TABLE ds_org_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org owners manage branding" ON ds_org_branding FOR ALL
  USING (org_id IN (SELECT id FROM ds_organizations WHERE owner_id = auth.uid()));

-- 3. Organization settings
CREATE TABLE IF NOT EXISTS ds_org_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES ds_organizations(id) ON DELETE CASCADE UNIQUE,
  require_kyc_for_transfer BOOLEAN DEFAULT FALSE,
  allow_investor_self_register BOOLEAN DEFAULT FALSE,
  default_property_visibility VARCHAR(20) DEFAULT 'private',  -- private, investors_only, public
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  currency VARCHAR(3) DEFAULT 'USD',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ds_org_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org owners manage settings" ON ds_org_settings FOR ALL
  USING (org_id IN (SELECT id FROM ds_organizations WHERE owner_id = auth.uid()));

-- 4. LP (investor) accounts — separate from operator auth
CREATE TABLE IF NOT EXISTS ds_lp_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES ds_organizations(id) ON DELETE CASCADE,
  investor_id UUID REFERENCES ds_investors(id) ON DELETE SET NULL,  -- link to investor record
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255),                      -- bcrypt hash
  magic_link_token VARCHAR(128),
  magic_link_expires TIMESTAMPTZ,
  name VARCHAR(200),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email)
);

CREATE INDEX idx_lp_org ON ds_lp_accounts(org_id);
CREATE INDEX idx_lp_email ON ds_lp_accounts(org_id, email);
CREATE INDEX idx_lp_investor ON ds_lp_accounts(investor_id);

ALTER TABLE ds_lp_accounts ENABLE ROW LEVEL SECURITY;
-- LP accounts readable by org owner (admin) or by the LP themselves via API
CREATE POLICY "Org owners manage LP accounts" ON ds_lp_accounts FOR ALL
  USING (org_id IN (SELECT id FROM ds_organizations WHERE owner_id = auth.uid()));

-- 5. Link properties to organizations
ALTER TABLE ds_properties ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES ds_organizations(id);
CREATE INDEX IF NOT EXISTS idx_properties_org ON ds_properties(org_id);

-- 6. Distributions table
CREATE TABLE IF NOT EXISTS ds_distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES ds_properties(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES ds_investors(id) ON DELETE CASCADE,
  amount_usd DECIMAL(12,2) NOT NULL,
  type VARCHAR(30) DEFAULT 'distribution',         -- distribution, return_of_capital, other
  period VARCHAR(20),                              -- e.g. "Q1 2026", "March 2026"
  status VARCHAR(20) DEFAULT 'pending',            -- pending, paid, failed
  tx_id VARCHAR(100),                              -- on-chain tx if applicable
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dist_property ON ds_distributions(property_id);
CREATE INDEX idx_dist_investor ON ds_distributions(investor_id);

ALTER TABLE ds_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org owners manage distributions" ON ds_distributions FOR ALL
  USING (property_id IN (
    SELECT id FROM ds_properties WHERE owner_id = auth.uid()
  ));
