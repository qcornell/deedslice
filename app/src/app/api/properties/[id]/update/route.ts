import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import type { Property } from "@/types/database";

/**
 * PATCH /api/properties/[id]/update
 * 
 * Update editable fields on a property (name, address, description,
 * valuation, property_type, image_url). Logs changes to HCS audit trail.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", params.id)
      .eq("owner_id", user.id)
      .single();

    const property = data as Property | null;
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const body = await req.json();

    // Only allow updating specific fields
    const allowedFields = ["name", "address", "description", "valuation_usd", "property_type", "image_url"];
    const updates: Record<string, any> = {};
    const changes: string[] = [];

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== (property as any)[field]) {
        updates[field] = body[field];
        const oldVal = (property as any)[field];
        const newVal = body[field];
        if (field === "valuation_usd") {
          changes.push(`Valuation: $${Number(oldVal).toLocaleString()} → $${Number(newVal).toLocaleString()}`);
        } else if (field === "image_url") {
          changes.push("Property image updated");
        } else {
          changes.push(`${field.replace(/_/g, " ")}: ${oldVal || "(empty)"} → ${newVal}`);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, message: "No changes" });
    }

    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("ds_properties")
      .update(updates as any)
      .eq("id", params.id);

    if (updateError) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    // Log to HCS audit trail
    const changeDescription = changes.join("; ");
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "PROPERTY_UPDATED", {
        propertyId: params.id,
        changes: changeDescription,
      }, (property as any).network as "mainnet" | "testnet");
    }

    // Log to DB audit entries
    const auditAction = updates.valuation_usd ? "VALUATION_UPDATED" : "PROPERTY_UPDATED";
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: params.id,
      action: auditAction,
      details: changeDescription,
    } as any);

    return NextResponse.json({ ok: true, changes: changeDescription });
  } catch (err) {
    console.error("Property update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
