import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import type { Property } from "@/types/database";

/** POST /api/audit — add an audit entry to a property's HCS trail */
export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { propertyId, action, details } = await req.json();

    if (!propertyId || !action) {
      return NextResponse.json({ error: "Missing propertyId or action" }, { status: 400 });
    }

    // Verify ownership
    const { data } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    const property = data as Property | null;

    if (!property || !property.audit_topic_id) {
      return NextResponse.json({ error: "Property not found or not deployed" }, { status: 404 });
    }

    // Write to HCS
    const hcsResult = await logAuditEntry(property.audit_topic_id, action, {
      propertyId,
      propertyName: property.name,
      details,
      userId: user.id,
    }, property.network as "mainnet" | "testnet");

    // Write to DB
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action,
      details: details || null,
      tx_id: hcsResult.txId || null,
      hcs_sequence: hcsResult.sequence ? parseInt(hcsResult.sequence) : null,
    });

    return NextResponse.json({
      ...hcsResult,
      ok: true,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
