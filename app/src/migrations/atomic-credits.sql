-- Atomic credit increment/decrement to prevent race conditions
-- Run this in Supabase SQL Editor

-- Increment tokenization credits (used by Stripe webhook)
CREATE OR REPLACE FUNCTION increment_tokenization_credits(user_id UUID, amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_credits INT;
BEGIN
  UPDATE ds_profiles
  SET tokenization_credits = COALESCE(tokenization_credits, 0) + amount
  WHERE id = user_id
  RETURNING tokenization_credits INTO new_credits;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', user_id;
  END IF;

  RETURN new_credits;
END;
$$;

-- Decrement tokenization credits (used by tokenize endpoint)
-- Returns the new credit count, or -1 if insufficient credits
CREATE OR REPLACE FUNCTION decrement_tokenization_credit(user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_credits INT;
BEGIN
  UPDATE ds_profiles
  SET tokenization_credits = tokenization_credits - 1
  WHERE id = user_id
    AND tokenization_credits > 0
  RETURNING tokenization_credits INTO new_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  RETURN new_credits;
END;
$$;

-- Atomic properties_used increment
CREATE OR REPLACE FUNCTION increment_properties_used(user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INT;
BEGIN
  UPDATE ds_profiles
  SET properties_used = COALESCE(properties_used, 0) + 1
  WHERE id = user_id
  RETURNING properties_used INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$;

-- Batch recalculate investor percentages in a single UPDATE
CREATE OR REPLACE FUNCTION recalculate_investor_percentages(p_property_id UUID, p_total_slices INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ds_investors
  SET percentage = ROUND((slices_owned::NUMERIC / p_total_slices) * 10000) / 100
  WHERE property_id = p_property_id;
END;
$$;
