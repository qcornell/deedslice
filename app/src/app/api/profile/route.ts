import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { sanitizeText } from "@/lib/sanitize";
import { applyRateLimitAsync } from "@/lib/rate-limit";

/**
 * GET /api/profile — get current user's profile (server-side, no RLS bypass risk)
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: profile } = await supabaseAdmin
      .from("ds_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // Auto-create profile if missing
      const { data: newProfile } = await supabaseAdmin
        .from("ds_profiles")
        .insert({
          id: user.id,
          email: user.email || "",
          plan: "starter",
          properties_used: 0,
          properties_limit: 999,
          tokenization_credits: 0,
        } as any)
        .select()
        .single();

      return NextResponse.json({ profile: newProfile });
    }

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/profile — update current user's profile (server-side)
 */
export async function PATCH(req: NextRequest) {
  // 10 profile updates per IP per 5 minutes
  const blocked = await applyRateLimitAsync(req.headers, "profile-update", { max: 10, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();

    // Only allow updating specific fields
    const updatePayload: Record<string, any> = {};
    if (body.full_name !== undefined) {
      updatePayload.full_name = body.full_name ? sanitizeText(body.full_name, 200) : null;
    }
    if (body.company_name !== undefined) {
      updatePayload.company_name = body.company_name ? sanitizeText(body.company_name, 200) : null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: profile, error: updateError } = await supabaseAdmin
      .from("ds_profiles")
      .update(updatePayload as any)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
