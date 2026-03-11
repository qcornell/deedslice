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

/**
 * DELETE /api/properties/[id] — hard delete a testnet property
 *
 * Rules:
 *   - network must be testnet (testnet assets are disposable)
 *   - no investors with transferred tokens (transfer_status = "transferred")
 *   - no token distributions exist
 *   - mainnet properties can NEVER be hard deleted (archive/delist only)
 */
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

    const p = property as any;

    // Rule 1: Must be testnet — mainnet is never deletable
    if (p.network !== "testnet") {
      return NextResponse.json({ error: "Mainnet properties cannot be deleted. Use archive or delist instead." }, { status: 400 });
    }

    // Rule 2: No investors with transferred tokens
    const { count: transferredCount } = await supabaseAdmin
      .from("ds_investors")
      .select("*", { count: "exact", head: true })
      .eq("property_id", params.id)
      .eq("transfer_status", "transferred");

    if (transferredCount && transferredCount > 0) {
      return NextResponse.json({ error: "Cannot delete property with transferred tokens. Investors have received on-chain tokens." }, { status: 400 });
    }

    // Rule 3: No token distributions
    const { count: distCount } = await supabaseAdmin
      .from("ds_distributions")
      .select("*", { count: "exact", head: true })
      .eq("property_id", params.id);

    if (distCount && distCount > 0) {
      return NextResponse.json({ error: "Cannot delete property with distribution history." }, { status: 400 });
    }

    // Safe to delete — clean up all related records
    // Delete documents
    await supabaseAdmin.from("ds_documents").delete().eq("property_id", params.id).then(() => {});

    // Delete token permissions
    await supabaseAdmin.from("ds_token_permissions").delete().eq("property_id", params.id).then(() => {});

    // Delete audit entries
    await supabaseAdmin.from("ds_audit_entries").delete().eq("property_id", params.id);

    // Delete investors (non-transferred only at this point)
    await supabaseAdmin.from("ds_investors").delete().eq("property_id", params.id);

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
