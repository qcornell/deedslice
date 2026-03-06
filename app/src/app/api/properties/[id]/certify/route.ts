import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/properties/[id]/certify — Issuer Compliance Certification
 *
 * The operator must certify they understand their legal responsibilities
 * before any token transfers can occur.
 *
 * Body: {
 *   offeringType: "506b" | "506c" | "regs" | "private" | "test",
 *   checkboxes: string[],  // list of certification items checked
 * }
 *
 * This stores an immutable record of the certification for legal protection.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const blocked = applyRateLimit(req.headers, "certify", { max: 10, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const propertyId = params.id;

    // Verify ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("id, owner_id, name, audit_topic_id, network")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!propData) {
      return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });
    }

    const property = propData as any;
    const body = await req.json();
    const { offeringType, checkboxes } = body;

    // Validate offering type
    const validTypes = ["506b", "506c", "regs", "private", "test"];
    if (!validTypes.includes(offeringType)) {
      return NextResponse.json({ error: "Invalid offering type" }, { status: 400 });
    }

    // All required checkboxes must be checked
    const requiredCheckboxes = [
      "responsible_for_compliance",
      "securities_laws_apply",
      "will_file_form_d",
      "not_broker_dealer",
      "not_legal_advice",
    ];

    const missing = requiredCheckboxes.filter(cb => !checkboxes?.includes(cb));
    if (missing.length > 0) {
      return NextResponse.json({
        error: `You must check all certification boxes. Missing: ${missing.join(", ")}`,
      }, { status: 400 });
    }

    // Determine compliance requirements based on offering type
    const requiresAccreditation = ["506c"].includes(offeringType);
    const requiresKyc = offeringType !== "test";
    const transferRestricted = offeringType !== "test";

    const certificationText = `I, the operator of this property tokenization, certify that: (1) I am solely responsible for verifying investor accreditation and securities compliance; (2) I understand that tokenized fractional ownership interests may constitute securities under applicable law; (3) I will file Form D with the SEC within 15 days of first sale if required; (4) DeedSlice is a technology infrastructure provider and does not act as a broker-dealer; (5) DeedSlice does not provide legal, tax, or investment advice.`;

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    const now = new Date().toISOString();

    // Update property with compliance settings
    await supabaseAdmin
      .from("ds_properties")
      .update({
        offering_type: offeringType,
        requires_accreditation: requiresAccreditation,
        requires_kyc: requiresKyc,
        transfer_restricted: transferRestricted,
        issuer_certified: true,
        issuer_certified_at: now,
        issuer_certified_ip: ip,
      } as any)
      .eq("id", propertyId);

    // Store immutable certification record
    await supabaseAdmin.from("ds_issuer_certifications").upsert({
      property_id: propertyId,
      user_id: user.id,
      certified_at: now,
      ip_address: ip,
      user_agent: userAgent,
      certification_text: certificationText,
      checkboxes_checked: checkboxes,
    } as any, { onConflict: "property_id" });

    // Audit log
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: "ISSUER_CERTIFIED",
      details: `Operator certified compliance. Offering: ${offeringType.toUpperCase()}. Requires accreditation: ${requiresAccreditation}. Requires KYC: ${requiresKyc}.`,
    } as any);

    // Log to HCS on-chain audit trail
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "ISSUER_CERTIFIED", {
        offeringType,
        requiresAccreditation,
        requiresKyc,
        transferRestricted,
        certifiedAt: now,
      }, property.network as "mainnet" | "testnet").catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      offeringType,
      requiresAccreditation,
      requiresKyc,
      transferRestricted,
      certifiedAt: now,
    });
  } catch (err) {
    console.error("Certify error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
