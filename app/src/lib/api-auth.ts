/**
 * REST API Key Authentication
 *
 * API keys are formatted as: ds_live_<32 hex chars>
 * We store only SHA-256 hashes in the DB. The raw key is shown once at creation.
 *
 * Auth flow:
 *   1. Client sends: Authorization: Bearer ds_live_abc123...
 *   2. We SHA-256 the key, look up the hash in ds_api_keys
 *   3. If found → load the user, check plan allows API access (Enterprise)
 *   4. Touch last_used_at
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const random = crypto.randomBytes(24).toString("hex"); // 48 hex chars
  const raw = `ds_live_${random}`;
  const prefix = raw.slice(0, 12); // "ds_live_xxxx"
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export interface ApiAuthResult {
  user_id: string;
  profile: Profile;
  key_id: string;
}

/**
 * Authenticate a request via API key.
 * Returns null if not an API key request (falls through to Supabase JWT).
 * Throws descriptive error string if key is invalid/unauthorized.
 */
export async function authenticateApiKey(authHeader: string | null): Promise<ApiAuthResult | null> {
  if (!authHeader) return null;

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !token.startsWith("ds_live_")) return null; // Not an API key, let JWT auth handle it

  const hash = hashApiKey(token);

  const { data: keyRow } = await supabaseAdmin
    .from("ds_api_keys")
    .select("*")
    .eq("key_hash", hash)
    .single();

  if (!keyRow) {
    throw new Error("Invalid API key");
  }

  // Load profile & check plan
  const { data: profile } = await supabaseAdmin
    .from("ds_profiles")
    .select("*")
    .eq("id", (keyRow as any).user_id)
    .single();

  if (!profile) {
    throw new Error("API key owner not found");
  }

  if ((profile as Profile).plan !== "enterprise") {
    throw new Error("REST API access requires Enterprise plan. Upgrade at console.deedslice.com/dashboard/settings");
  }

  // Touch last_used_at (fire and forget)
  supabaseAdmin
    .from("ds_api_keys")
    .update({ last_used_at: new Date().toISOString() } as any)
    .eq("id", (keyRow as any).id)
    .then(() => {});

  return {
    user_id: (keyRow as any).user_id,
    profile: profile as Profile,
    key_id: (keyRow as any).id,
  };
}
