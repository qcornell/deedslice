import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * PATCH /api/investors/accreditation — Update investor accreditation status
 *
 * Body: {
 *   investorId: string,
 *   status: "verified" | "rejected" | "pending" | "expired",
 *   method?: "self_attested" | "document_upload" | "third_party" | "manual_override",
 *   notes?: string,
 *   expiryDays?: number,  // default 90 days from now
 * }
 *
 * Only the property owner can update accreditation status.
 */
export async function PATCH(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "accreditation", { max: 30, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { investorId, status, method, notes, expiryDays } = body;

    if (!investorId || !status) {
      return NextResponse.json({ error: "Missing investorId or status" }, { status: 400 });
    }

    const validStatuses = ["verified", "rejected", "pending", "expired", "none"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid accreditation status" }, { status: 400 });
    }

    // Load investor
    const { data: invData } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, property_id, kyc_status")
      .eq("id", investorId)
      .single();

    if (!invData) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    const investor = invData as any;

    // Verify property ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("id, owner_id, name, audit_topic_id, network, share_token_id")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    if (!propData) {
      return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });
    }

    const property = propData as any;

    // Calculate expiry (default 90 days for verified status)
    let expiry: string | null = null;
    if (status === "verified") {
      const days = expiryDays || 90;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      expiry = expiryDate.toISOString();
    }

    // Update investor
    await supabaseAdmin
      .from("ds_investors")
      .update({
        accreditation_status: status,
        accreditation_method: method || (status === "verified" ? "manual_override" : null),
        accreditation_verified_at: status === "verified" ? new Date().toISOString() : null,
        accreditation_verified_by: status === "verified" ? user.id : null,
        accreditation_expiry: expiry,
        accreditation_notes: notes || null,
      } as any)
      .eq("id", investorId);

    // Audit log — database
    const auditAction = status === "verified" ? "ACCREDITATION_VERIFIED"
      : status === "rejected" ? "ACCREDITATION_REJECTED"
      : status === "expired" ? "ACCREDITATION_EXPIRED"
      : "ACCREDITATION_UPDATED";

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: property.id,
      action: auditAction,
      details: `${investor.name}: accreditation ${status}${method ? ` (${method})` : ""}${notes ? ` — ${notes}` : ""}`,
    } as any);

    // Audit log — HCS on-chain
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, auditAction, {
        investor: investor.name,
        investorId: investor.id,
        from: "previous",
        to: status,
        method: method || "manual_override",
        expiry: expiry,
      }, property.network as "mainnet" | "testnet").catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      investorId,
      accreditationStatus: status,
      expiry,
    });
  } catch (err) {
    console.error("Accreditation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
