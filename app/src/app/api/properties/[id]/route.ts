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

/** DELETE /api/properties/[id] — hard delete a property (failed/draft, testnet, no investors) */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Fetch property and verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Check conditions: status must be failed/draft, network must be testnet
    if (!["failed", "draft"].includes((property as any).status)) {
      return NextResponse.json({ error: "Only failed or draft properties can be deleted" }, { status: 400 });
    }
    if ((property as any).network !== "testnet") {
      return NextResponse.json({ error: "Only testnet properties can be deleted" }, { status: 400 });
    }

    // Check no investors attached
    const { count } = await supabaseAdmin
      .from("ds_investors")
      .select("*", { count: "exact", head: true })
      .eq("property_id", params.id);

    if (count && count > 0) {
      return NextResponse.json({ error: "Cannot delete property with investors" }, { status: 400 });
    }

    // Delete audit entries first (cascade)
    await supabaseAdmin
      .from("ds_audit_entries")
      .delete()
      .eq("property_id", params.id);

    // Delete investors (should be 0 but cleanup)
    await supabaseAdmin
      .from("ds_investors")
      .delete()
      .eq("property_id", params.id);

    // Delete the property
    const { error: deleteError } = await supabaseAdmin
      .from("ds_properties")
      .delete()
      .eq("id", params.id)
      .eq("owner_id", user.id);

    if (deleteError) {
      return NextResponse.json({ error: "Failed to delete property" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
