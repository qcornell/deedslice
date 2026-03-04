import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/**
 * GET /api/audit/all
 * 
 * Returns all audit entries across all of the user's properties in one query.
 * Avoids the N+1 problem of fetching each property separately.
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Get all property IDs owned by this user
    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("id, name, status")
      .eq("owner_id", user.id);

    if (!properties || properties.length === 0) {
      return NextResponse.json({ auditEntries: [], properties: [] });
    }

    const propertyIds = properties.map((p: any) => p.id);

    // Pagination
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "100")));
    const offset = (page - 1) * limit;

    // Single query for ALL audit entries across all properties
    const { data: entries, count } = await supabaseAdmin
      .from("ds_audit_entries")
      .select("*", { count: "exact" })
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Build a name lookup map
    const nameMap: Record<string, string> = {};
    for (const p of properties) {
      nameMap[(p as any).id] = (p as any).name;
    }

    // Attach property name to each entry
    const enriched = (entries || []).map((e: any) => ({
      ...e,
      _propertyName: nameMap[e.property_id] || "",
    }));

    return NextResponse.json({
      auditEntries: enriched,
      properties: properties.filter((p: any) => p.status === "live"),
      pagination: { page, limit, total: count ?? enriched.length, pages: Math.ceil((count ?? enriched.length) / limit) },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
