-- Persistent rate limiting table + RPC function
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ds_rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_sec INTEGER NOT NULL DEFAULT 3600
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_ds_rate_limits_window ON ds_rate_limits(window_start);

-- Auto-cleanup old entries (runs every hour via pg_cron if available, or manually)
-- DELETE FROM ds_rate_limits WHERE window_start + (window_sec || ' seconds')::interval < now();

-- RPC function: atomic check-and-increment
-- Returns TRUE if allowed, FALSE if blocked.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_sec INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Try to get existing entry
  SELECT count, window_start INTO v_count, v_window_start
  FROM ds_rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First request: insert and allow
    INSERT INTO ds_rate_limits (key, count, window_start, window_sec)
    VALUES (p_key, 1, now(), p_window_sec)
    ON CONFLICT (key) DO UPDATE SET
      count = 1,
      window_start = now(),
      window_sec = p_window_sec;
    RETURN TRUE;
  END IF;

  -- Check if window has expired
  IF v_window_start + (p_window_sec || ' seconds')::interval < now() THEN
    -- Reset window
    UPDATE ds_rate_limits
    SET count = 1, window_start = now(), window_sec = p_window_sec
    WHERE key = p_key;
    RETURN TRUE;
  END IF;

  -- Window still active: check count
  IF v_count >= p_max THEN
    RETURN FALSE; -- Blocked
  END IF;

  -- Increment and allow
  UPDATE ds_rate_limits
  SET count = count + 1
  WHERE key = p_key;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
