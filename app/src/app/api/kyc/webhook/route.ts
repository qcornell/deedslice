import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { constructWebhookEvent, mapStripeStatus } from "@/lib/stripe-identity";
import { logAuditEntry } from "@/lib/hedera/engine";
import { fireWebhooks } from "@/lib/webhooks";

const KYC_WEBHOOK_SECRET = process.env.STRIPE_KYC_WEBHOOK_SECRET || "";

/**
 * POST /api/kyc/webhook — Stripe Identity webhook receiver
 *
 * Handles:
 *   - identity.verification_session.verified → KYC passed
 *   - identity.verification_session.requires_input → needs resubmission
 *   - identity.verification_session.canceled → canceled
 *
 * Stripe sends investor metadata (ds_investor_id, ds_property_id)
 * that we set during session creation.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    // Verify Stripe signature
    let event;
    try {
      event = constructWebhookEvent(rawBody, signature, KYC_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("KYC webhook signature failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Only handle identity events
    if (!event.type.startsWith("identity.verification_session.")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const session = event.data.object as any;
    const investorId = session.metadata?.ds_investor_id;
    const propertyId = session.metadata?.ds_property_id;

    if (!investorId) {
      console.log("KYC webhook: no ds_investor_id in metadata, ignoring");
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Map Stripe status to our status
    const newStatus = mapStripeStatus(session.status);

    // Load investor
    const { data: inv } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, kyc_status, property_id")
      .eq("id", investorId)
      .single();

    if (!inv) {
      console.error(`KYC webhook: investor ${investorId} not found`);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const investor = inv as any;
    const oldStatus = investor.kyc_status || "unverified";

    // Skip if no change
    if (oldStatus === newStatus) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    // Build notes
    let notes = "";
    if (newStatus === "verified") {
      notes = "Stripe Identity: verified";
    } else if (newStatus === "pending" && session.status === "requires_input") {
      const errorCode = session.last_error?.code || "unknown";
      const errorReason = session.last_error?.reason || "";
      notes = `Stripe Identity: resubmission needed (${errorCode}${errorReason ? ` — ${errorReason}` : ""})`;
    } else if (newStatus === "unverified") {
      notes = "Stripe Identity: session canceled";
    }

    // Update investor
    await supabaseAdmin
      .from("ds_investors")
      .update({
        kyc_status: newStatus,
        kyc_reviewed_at: new Date().toISOString(),
        kyc_notes: notes,
      } as any)
      .eq("id", investorId);

    // Load property for audit logging
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("id, owner_id, audit_topic_id, network")
      .eq("id", propertyId || investor.property_id)
      .single();

    const property = propData as any;

    if (property) {
      // Audit log action
      const auditAction =
        newStatus === "verified" ? "KYC_VERIFIED" :
        newStatus === "rejected" ? "KYC_REJECTED" :
        newStatus === "pending" ? "KYC_RESUBMIT_NEEDED" :
        "KYC_STATUS_UPDATED";

      const auditDetails =
        newStatus === "verified"
          ? `${investor.name} passed identity verification (Stripe Identity)`
          : newStatus === "pending"
            ? `${investor.name} needs to resubmit identity documents`
            : `${investor.name} KYC status → ${newStatus}`;

      // Log to HCS on-chain audit trail
      if (property.audit_topic_id) {
        await logAuditEntry(
          property.audit_topic_id,
          auditAction,
          {
            investor: investor.name,
            from: oldStatus,
            to: newStatus,
            stripeSessionId: session.id,
          },
          property.network as "mainnet" | "testnet"
        ).catch(err => console.error("HCS audit log error:", err));
      }

      // Log to local audit table
      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: property.id,
        action: auditAction,
        details: auditDetails,
      } as any);

      // Fire operator webhooks
      fireWebhooks(property.owner_id, "kyc.updated", {
        propertyId: property.id,
        investorId: investor.id,
        investorName: investor.name,
        from: oldStatus,
        to: newStatus,
        stripeSessionId: session.id,
      }).catch(() => {});
    }

    console.log(`KYC ${newStatus}: ${investor.name} (${investorId})`);
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error("KYC webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
