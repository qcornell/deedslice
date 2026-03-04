-- Add token transfer tracking columns to ds_investors
-- Run this in Supabase SQL Editor

ALTER TABLE ds_investors
  ADD COLUMN IF NOT EXISTS transfer_status text DEFAULT NULL
    CHECK (transfer_status IN ('pending', 'transferred', 'failed')),
  ADD COLUMN IF NOT EXISTS transfer_tx_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transferred_at timestamptz DEFAULT NULL;

-- Index for quick lookup of pending transfers
CREATE INDEX IF NOT EXISTS idx_ds_investors_transfer_status
  ON ds_investors (transfer_status)
  WHERE transfer_status IS NOT NULL;
