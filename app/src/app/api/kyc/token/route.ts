import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { verifyLpToken } from "@/lib/lp-auth";
import { createVerificationSession } from "@/lib/stripe-identity";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/kyc/token — Create Stripe Identity verification session
 *
 * Two auth modes:
 *   1. Operator: Bearer <supabase-jwt> + { investorId }
 *      → Operator initiates KYC for a specific investor
 *   2. LP Portal: Bearer <lp-jwt>
 *      → Investor initiates their own KYC from the portal
 *
 * Returns: { clientSecret, sessionId, investorId }
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "kyc-token", { max: 20, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    // ── LP Portal auth ──
    const lpSession = verifyLpToken(token);
    if (lpSession) {
      // Find investor record by email or direct link
      let investorId = lpSession.investor_id;
      let investorData: any = null;

      if (investorId) {
        const { data } = await supabaseAdmin
          .from("ds_investors")
          .select("id, name, email, property_id, kyc_status")
          .eq("id", investorId)
          .single();
        investorData = data;
      } else {
        // Find by email within this org's properties
        const { data: investors } = await supabaseAdmin
          .from("ds_investors")
          .select("id, name, email, property_id, kyc_status")
          .eq("email", lpSession.email)
          .limit(1);

        if (investors && investors.length > 0) {
          investorData = investors[0];
          investorId = (investorData as any).id;
        }
      }

      if (!investorData) {
        return NextResponse.json({ error: "No investor record found for your account" }, { status: 404 });
      }

      // Already verified? No need to create another session
      if ((investorData as any).kyc_status === "verified") {
        return NextResponse.json({ error: "Already verified", status: "verified" }, { status: 400 });
      }

      const result = await createVerificationSession({
        investorId: investorId!,
        investorName: (investorData as any).name,
        investorEmail: lpSession.email,
        propertyId: (investorData as any).property_id,
      });

      // Update status to pending
      await supabaseAdmin
        .from("ds_investors")
        .update({
          kyc_status: "pending",
          kyc_notes: `Stripe session: ${result.sessionId}`,
        } as any)
        .eq("id", investorId);

      return NextResponse.json({
        clientSecret: result.clientSecret,
        sessionId: result.sessionId,
        investorId,
      });
    }

    // ── Operator auth ──
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { investorId } = body;
    if (!investorId) {
      return NextResponse.json({ error: "Missing investorId" }, { status: 400 });
    }

    // Load investor
    const { data: inv } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, property_id, kyc_status")
      .eq("id", investorId)
      .single();

    if (!inv) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    const investor = inv as any;

    // Verify property ownership
    const { data: prop } = await supabaseAdmin
      .from("ds_properties")
      .select("owner_id")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    if (!prop) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (investor.kyc_status === "verified") {
      return NextResponse.json({ error: "Already verified", status: "verified" }, { status: 400 });
    }

    const result = await createVerificationSession({
      investorId,
      investorName: investor.name,
      investorEmail: investor.email || undefined,
      propertyId: investor.property_id,
    });

    // Update status
    await supabaseAdmin
      .from("ds_investors")
      .update({
        kyc_status: "pending",
        kyc_notes: `Stripe session: ${result.sessionId}`,
      } as any)
      .eq("id", investorId);

    return NextResponse.json({
      clientSecret: result.clientSecret,
      sessionId: result.sessionId,
      investorId,
    });
  } catch (err: any) {
    console.error("KYC session error:", err);
    return NextResponse.json({ error: err.message || "Failed to create verification session" }, { status: 500 });
  }
}
