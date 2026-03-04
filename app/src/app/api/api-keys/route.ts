import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { generateApiKey } from "@/lib/api-auth";
import { applyRateLimit } from "@/lib/rate-limit";
import type { Profile } from "@/types/database";

/**
 * GET /api/api-keys — List user's API keys (prefix + name + last used, never the full key)
 * POST /api/api-keys — Create a new API key (returns the raw key ONCE)
 * DELETE /api/api-keys — Delete an API key by id
 */

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: keys } = await supabaseAdmin
      .from("ds_api_keys")
      .select("id, key_prefix, name, last_used_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ keys: keys || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "create-api-key", { max: 5, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Check plan
    const { data: profileData } = await supabaseAdmin
      .from("ds_profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const profile = profileData as Profile | null;

    if (!profile || profile.plan !== "enterprise") {
      return NextResponse.json({ error: "REST API access requires Enterprise plan." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const keyName = (body as any).name || "Default";

    const { raw, prefix, hash } = generateApiKey();

    await supabaseAdmin.from("ds_api_keys").insert({
      user_id: user.id,
      key_prefix: prefix,
      key_hash: hash,
      name: keyName,
    } as any);

    // Return the raw key ONCE — never stored or retrievable again
    return NextResponse.json({
      key: raw,
      prefix,
      name: keyName,
      message: "Save this key — it won't be shown again.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing key id" }, { status: 400 });

    await supabaseAdmin
      .from("ds_api_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
