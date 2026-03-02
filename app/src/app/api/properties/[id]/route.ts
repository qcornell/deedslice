import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/** GET /api/properties/[id] — full property detail with investors + audit log */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("property_id", (property as any).id)
      .order("percentage", { ascending: false });

    const { data: auditEntries } = await supabaseAdmin
      .from("ds_audit_entries")
      .select("*")
      .eq("property_id", (property as any).id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      property,
      investors: investors || [],
      auditEntries: auditEntries || [],
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
