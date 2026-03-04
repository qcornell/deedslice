import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import type { Property, Investor } from "@/types/database";

/**
 * PATCH /api/investors/update
 *
 * Update an investor's details (wallet address, name, email).
 *
 * Body: { investorId: string, walletAddress?: string, name?: string, email?: string }
 */
export async function PATCH(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { investorId, walletAddress, name, email } = await req.json();

    if (!investorId) {
      return NextResponse.json({ error: "Missing investorId" }, { status: 400 });
    }

    // Load investor
    const { data: investorData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("id", investorId)
      .single();

    const investor = investorData as Investor | null;

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    // Verify property ownership
    const { data: propertyData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    const property = propertyData as Property | null;

    if (!property) {
      return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, any> = {};
    const changes: string[] = [];

    if (walletAddress !== undefined) {
      // Validate format if provided
      if (walletAddress && !/^0\.0\.\d+$/.test(walletAddress)) {
        return NextResponse.json({ error: `Invalid Hedera account ID format: ${walletAddress}. Expected: 0.0.XXXXX` }, { status: 400 });
      }
      updates.wallet_address = walletAddress || null;
      changes.push(`wallet: ${walletAddress || "removed"}`);
    }

    if (name !== undefined && name) {
      updates.name = name;
      changes.push(`name: ${name}`);
    }

    if (email !== undefined) {
      updates.email = email || null;
      changes.push(`email: ${email || "removed"}`);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from("ds_investors")
      .update(updates as any)
      .eq("id", investorId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update investor" }, { status: 500 });
    }

    // Log to audit
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "INVESTOR_UPDATED", {
        investor: investor.name,
        changes: changes.join(", "),
      }, property.network as "mainnet" | "testnet");
    }

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: property.id,
      action: "INVESTOR_UPDATED",
      details: `Updated ${investor.name}: ${changes.join(", ")}`,
    } as any);

    return NextResponse.json({ ok: true, changes: changes.join(", ") });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
