import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/properties — List all properties (API key auth, Enterprise only)
 */
export async function GET(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "api-v1-list", { max: 60, windowSec: 60 });
  if (blocked) return blocked;

  try {
    const auth = await authenticateApiKey(req.headers.get("authorization"));
    if (!auth) return NextResponse.json({ error: "API key required. Format: Authorization: Bearer ds_live_..." }, { status: 401 });

    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("owner_id", auth.user_id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ ok: true, properties: properties || [] });
  } catch (err: any) {
    if (err.message?.includes("API key") || err.message?.includes("Enterprise")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
