-- Add tokenization_credits column to ds_profiles
-- Run this in Supabase SQL Editor

ALTER TABLE ds_profiles
ADD COLUMN IF NOT EXISTS tokenization_credits integer NOT NULL DEFAULT 0;

-- Update properties_limit to 999 for all plans (no longer plan-gated)
UPDATE ds_profiles SET properties_limit = 999 WHERE properties_limit < 999;

COMMENT ON COLUMN ds_profiles.tokenization_credits IS 'Number of mainnet tokenization credits remaining. Purchased via Stripe ($1,499/1 or $4,999/5). Enterprise has unlimited (check plan instead).';
