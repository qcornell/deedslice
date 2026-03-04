-- Add dark mode logo URL column to org branding
-- Run this in Supabase SQL editor

ALTER TABLE ds_org_branding
ADD COLUMN IF NOT EXISTS logo_dark_url text DEFAULT NULL;

COMMENT ON COLUMN ds_org_branding.logo_dark_url IS 'Logo for dark mode backgrounds (light/white variant). Falls back to logo_url if NULL.';
