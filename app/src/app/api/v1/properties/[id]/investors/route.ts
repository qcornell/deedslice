import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { handleCorsPreFlight, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCorsPreFlight();
}

/**
 * GET /api/v1/properties/:id/investors — List investors for a property
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req.headers, "api-v1-investors", { max: 60, windowSec: 60 });
  if (blocked) return withCors(blocked);

  try {
    const auth = await authenticateApiKey(req.headers.get("authorization"));
    if (!auth) return withCors(NextResponse.json({ error: "API key required" }, { status: 401 }));

    // Verify ownership
    const { data: prop } = await supabaseAdmin
      .from("ds_properties")
      .select("id")
      .eq("id", params.id)
      .eq("owner_id", auth.user_id)
      .single();

    if (!prop) return withCors(NextResponse.json({ error: "Property not found" }, { status: 404 }));

    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("property_id", params.id)
      .order("percentage", { ascending: false });

    return withCors(NextResponse.json({ ok: true, investors: investors || [] }));
  } catch (err: any) {
    if (err.message?.includes("API key") || err.message?.includes("Enterprise")) {
      return withCors(NextResponse.json({ error: err.message }, { status: 403 }));
    }
    return withCors(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
  }
}
