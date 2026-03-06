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

    // Step 1: Get all properties for this user
    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const allProps = properties || [];
    const livePropertyIds = allProps.filter((p: any) => p.status === "live").map((p: any) => p.id);
    const allPropertyIds = allProps.map((p: any) => p.id);

    // Build name lookup
    const nameMap = new Map(allProps.map((p: any) => [p.id, p.name]));

    // Step 2: Fetch investors + audit in parallel (simple queries, no joins)
    const [investorsRes, auditRes] = await Promise.all([
      livePropertyIds.length > 0
        ? supabaseAdmin
            .from("ds_investors")
            .select("*")
            .in("property_id", livePropertyIds)
            .order("percentage", { ascending: false })
        : Promise.resolve({ data: [] }),

      allPropertyIds.length > 0
        ? supabaseAdmin
            .from("ds_audit_entries")
            .select("*")
            .in("property_id", allPropertyIds)
            .order("created_at", { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    // Attach property names to investors
    const investors = (investorsRes.data || []).map((inv: any) => ({
      ...inv,
      _propertyName: nameMap.get(inv.property_id) || "",
    }));

    const auditEntries = auditRes.data || [];

    return NextResponse.json({
      properties: allProps,
      investors,
      auditEntries,
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
