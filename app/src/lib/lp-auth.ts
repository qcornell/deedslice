/**
 * LP (Limited Partner) Authentication
 *
 * Separate from operator auth (Supabase Auth).
 * LPs authenticate via:
 *   1. Magic link (email → click → session)
 *   2. Password (email + password → session)
 *
 * Sessions are JWT tokens signed with a server secret,
 * scoped to an org_id + lp_account_id.
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { LpAccount } from "@/types/database";

const LP_SECRET = (() => {
  const secret = process.env.LP_JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL: LP_JWT_SECRET (or NEXTAUTH_SECRET) must be set in production. " +
        "LP sessions cannot be securely signed without a server secret."
      );
    }
    // Dev/build fallback only — never used in production
    console.warn("⚠️  LP_JWT_SECRET not set — using insecure dev fallback. Set LP_JWT_SECRET before deploying.");
    return "deedslice-lp-dev-only-insecure";
  }
  return secret;
})();

// Simple JWT implementation (no dependency needed for HS256)
function base64url(str: string): string {
  return Buffer.from(str).toString("base64url");
}

function sign(payload: object, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verify(token: string, secret: string): object | null {
  try {
    const [header, body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface LpSession {
  lp_id: string;
  org_id: string;
  email: string;
  name: string | null;
  investor_id: string | null;
}

/**
 * Create a session token for an LP.
 */
export function createLpToken(lp: LpAccount): string {
  return sign(
    {
      sub: lp.id,
      org_id: lp.org_id,
      email: lp.email,
      name: lp.name,
      investor_id: lp.investor_id,
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    },
    LP_SECRET
  );
}

/**
 * Verify an LP session token.
 */
export function verifyLpToken(token: string): LpSession | null {
  const payload = verify(token, LP_SECRET) as any;
  if (!payload || !payload.sub || !payload.org_id) return null;
  return {
    lp_id: payload.sub,
    org_id: payload.org_id,
    email: payload.email,
    name: payload.name || null,
    investor_id: payload.investor_id || null,
  };
}

/**
 * Generate a magic link token and store it.
 */
export async function generateMagicLink(orgId: string, email: string): Promise<string | null> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  const { data: lp } = await supabaseAdmin
    .from("ds_lp_accounts")
    .select("id")
    .eq("org_id", orgId)
    .eq("email", email.toLowerCase())
    .single();

  if (!lp) return null;

  await supabaseAdmin
    .from("ds_lp_accounts")
    .update({
      magic_link_token: token,
      magic_link_expires: expires,
    } as any)
    .eq("id", (lp as any).id);

  return token;
}

/**
 * Verify a magic link token and return the LP account.
 */
export async function verifyMagicLink(orgId: string, token: string): Promise<LpAccount | null> {
  const { data: lp } = await supabaseAdmin
    .from("ds_lp_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("magic_link_token", token)
    .single();

  if (!lp) return null;
  const account = lp as LpAccount;

  // Check expiry
  if (account.magic_link_expires && new Date(account.magic_link_expires) < new Date()) {
    return null;
  }

  // Clear the token (single use)
  await supabaseAdmin
    .from("ds_lp_accounts")
    .update({
      magic_link_token: null,
      magic_link_expires: null,
      last_login_at: new Date().toISOString(),
    } as any)
    .eq("id", account.id);

  return account;
}

/**
 * Hash a password for LP accounts.
 */
export function hashPassword(password: string): string {
  // Simple PBKDF2 — adequate for LP portal passwords
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed));
}
