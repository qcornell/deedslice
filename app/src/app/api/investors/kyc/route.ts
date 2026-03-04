import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { fireWebhooks } from "@/lib/webhooks";
import { applyRateLimit } from "@/lib/rate-limit";
import type { Property, Investor } from "@/types/database";

/**
 * PATCH /api/investors/kyc — Update KYC status for an investor
 *
 * Body: { investorId, status: "unverified"|"pending"|"verified"|"rejected", notes? }
 */
export async function PATCH(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "kyc-update", { max: 30, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { investorId, status, notes } = await req.json();

    if (!investorId || !status) {
      return NextResponse.json({ error: "Missing investorId or status" }, { status: 400 });
    }

    const validStatuses = ["unverified", "pending", "verified", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
    }

    // Load investor
    const { data: investorData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("id", investorId)
      .single();

    const investor = investorData as Investor | null;
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 });

    // Verify property ownership
    const { data: propertyData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    const property = propertyData as Property | null;
    if (!property) return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });

    const oldStatus = investor.kyc_status || "unverified";

    // Update KYC status
    await supabaseAdmin
      .from("ds_investors")
      .update({
        kyc_status: status,
        kyc_notes: notes || null,
        kyc_reviewed_at: status !== "unverified" ? new Date().toISOString() : null,
      } as any)
      .eq("id", investorId);

    // Log to HCS audit
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "KYC_STATUS_UPDATED", {
        investor: investor.name,
        from: oldStatus,
        to: status,
        notes: notes || undefined,
      }, property.network as "mainnet" | "testnet");
    }

    // Log to local audit
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: property.id,
      action: "KYC_STATUS_UPDATED",
      details: `${investor.name}: ${oldStatus} → ${status}${notes ? ` (${notes})` : ""}`,
    } as any);

    // Fire webhooks
    fireWebhooks(user.id, "kyc.updated", {
      propertyId: property.id,
      investorId: investor.id,
      investorName: investor.name,
      from: oldStatus,
      to: status,
      notes,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
