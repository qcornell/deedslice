import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/**
 * GET /api/dashboard/summary
 *
 * Single endpoint that returns everything the dashboard needs:
 *   - All properties
 *   - All investors (across all live properties)
 *   - Recent audit entries (last 5)
 *
 * Replaces the N+1 pattern of fetching each property individually.
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Fetch all three in parallel — 3 queries instead of 3*N
    const [propertiesRes, investorsRes, auditRes] = await Promise.all([
      supabaseAdmin
        .from("ds_properties")
        .select("*")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),

      supabaseAdmin
        .from("ds_investors")
        .select("*, ds_properties!inner(owner_id, name, status)")
        .eq("ds_properties.owner_id", user.id)
        .eq("ds_properties.status", "live")
        .order("percentage", { ascending: false }),

      supabaseAdmin
        .from("ds_audit_entries")
        .select("*, ds_properties!inner(owner_id)")
        .eq("ds_properties.owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const properties = propertiesRes.data || [];

    // Map investors with property name attached
    const investors = (investorsRes.data || []).map((inv: any) => ({
      ...inv,
      _propertyName: inv.ds_properties?.name || "",
      ds_properties: undefined, // strip the join data
    }));

    const auditEntries = (auditRes.data || []).map((entry: any) => ({
      ...entry,
      ds_properties: undefined,
    }));

    return NextResponse.json({
      properties,
      investors,
      auditEntries,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
