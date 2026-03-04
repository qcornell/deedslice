import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { handleCorsPreFlight, withCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCorsPreFlight();
}

/**
 * GET /api/v1/properties/:id — Get property detail + investors + audit
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const blocked = applyRateLimit(req.headers, "api-v1-detail", { max: 60, windowSec: 60 });
  if (blocked) return withCors(blocked);

  try {
    const auth = await authenticateApiKey(req.headers.get("authorization"));
    if (!auth) return withCors(NextResponse.json({ error: "API key required" }, { status: 401 }));

    const { id } = params;

    const [propRes, invRes, auditRes] = await Promise.all([
      supabaseAdmin.from("ds_properties").select("*").eq("id", id).eq("owner_id", auth.user_id).single(),
      supabaseAdmin.from("ds_investors").select("*").eq("property_id", id).order("percentage", { ascending: false }),
      supabaseAdmin.from("ds_audit_entries").select("*").eq("property_id", id).order("created_at", { ascending: false }).limit(50),
    ]);

    if (propRes.error || !propRes.data) {
      return withCors(NextResponse.json({ error: "Property not found" }, { status: 404 }));
    }

    return withCors(NextResponse.json({
      ok: true,
      property: propRes.data,
      investors: invRes.data || [],
      auditEntries: auditRes.data || [],
    }));
  } catch (err: any) {
    if (err.message?.includes("API key") || err.message?.includes("Enterprise")) {
      return withCors(NextResponse.json({ error: err.message }, { status: 403 }));
    }
    return withCors(NextResponse.json({ error: "Internal server error" }, { status: 500 }));
  }
}
