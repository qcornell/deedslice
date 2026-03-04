import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { getVerificationSession } from "@/lib/stripe-identity";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/kyc/status?investorId=xxx — Check KYC status
 *
 * Returns our DB status and live Stripe Identity session status.
 * Operator-only endpoint.
 */
export async function GET(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "kyc-status", { max: 30, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const investorId = req.nextUrl.searchParams.get("investorId");
    if (!investorId) return NextResponse.json({ error: "Missing investorId" }, { status: 400 });

    // Load investor + verify ownership
    const { data: inv } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, kyc_status, kyc_notes, kyc_reviewed_at, property_id")
      .eq("id", investorId)
      .single();

    if (!inv) return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    const investor = inv as any;

    // Verify ownership
    const { data: prop } = await supabaseAdmin
      .from("ds_properties")
      .select("owner_id")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    if (!prop) return NextResponse.json({ error: "Access denied" }, { status: 403 });

    // Try to get live Stripe session status from notes
    let stripeStatus = null;
    const sessionMatch = investor.kyc_notes?.match(/Stripe session: (vs_\w+)/);
    if (sessionMatch) {
      try {
        stripeStatus = await getVerificationSession(sessionMatch[1]);
      } catch {
        // Session might not exist yet
      }
    }

    return NextResponse.json({
      investorId: investor.id,
      name: investor.name,
      email: investor.email,
      dbStatus: investor.kyc_status,
      dbNotes: investor.kyc_notes,
      reviewedAt: investor.kyc_reviewed_at,
      stripe: stripeStatus,
    });
  } catch (err: any) {
    console.error("KYC status error:", err);
    return NextResponse.json({ error: "Failed to check status" }, { status: 500 });
  }
}
