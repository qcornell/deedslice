import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyLpToken } from "@/lib/lp-auth";

/**
 * GET /api/lp/dashboard — LP dashboard data
 *
 * Returns portfolio overview + properties + distributions for the authenticated LP.
 * Auth: Bearer <lp-jwt-token>
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = verifyLpToken(token);
    if (!session) return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });

    // Get all investor records linked to this LP
    let investorIds: string[] = [];

    if (session.investor_id) {
      investorIds = [session.investor_id];
    } else {
      // Find investor records by email across org's properties
      const { data: investors } = await supabaseAdmin
        .from("ds_investors")
        .select("id, property_id")
        .eq("email", session.email);

      if (investors) {
        // Filter to only properties owned by this org
        const propIds = investors.map((i: any) => i.property_id);
        const { data: props } = await supabaseAdmin
          .from("ds_properties")
          .select("id, org_id")
          .in("id", propIds);

        const orgPropIds = new Set((props || []).filter((p: any) => p.org_id === session.org_id).map((p: any) => p.id));
        investorIds = investors.filter((i: any) => orgPropIds.has(i.property_id)).map((i: any) => i.id);
      }
    }

    if (investorIds.length === 0) {
      return NextResponse.json({
        portfolio: { totalValue: 0, totalInvested: 0, propertyCount: 0, totalDistributions: 0 },
        properties: [],
        distributions: [],
      });
    }

    // Load investor records with property data
    const { data: investorRecords } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .in("id", investorIds);

    const propertyIds = [...new Set((investorRecords || []).map((i: any) => i.property_id))];

    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .in("id", propertyIds);

    // Load distributions
    const { data: distributions } = await supabaseAdmin
      .from("ds_distributions")
      .select("*")
      .in("investor_id", investorIds)
      .order("created_at", { ascending: false })
      .limit(50);

    // Load recent audit entries for these properties
    const { data: auditEntries } = await supabaseAdmin
      .from("ds_audit_entries")
      .select("*")
      .in("property_id", propertyIds)
      .order("created_at", { ascending: false })
      .limit(20);

    // Build portfolio summary
    const propMap = new Map((properties || []).map((p: any) => [p.id, p]));
    let totalValue = 0;
    let totalDistributions = 0;

    const enrichedProperties = (investorRecords || []).map((inv: any) => {
      const prop = propMap.get(inv.property_id) as any;
      if (!prop) return null;
      const pricePerSlice = prop.valuation_usd / prop.total_slices;
      const investmentValue = pricePerSlice * inv.slices_owned;
      totalValue += investmentValue;

      return {
        propertyId: prop.id,
        name: prop.name,
        address: prop.address,
        propertyType: prop.property_type,
        imageUrl: prop.image_url,
        status: prop.status,
        network: prop.network,
        valuation: prop.valuation_usd,
        totalSlices: prop.total_slices,
        mySlices: inv.slices_owned,
        myPercentage: inv.percentage,
        myValue: Math.round(investmentValue),
        pricePerSlice: Math.round(pricePerSlice),
        shareTokenId: prop.share_token_id,
        shareTokenSymbol: prop.share_token_symbol,
        nftTokenId: prop.nft_token_id,
        auditTopicId: prop.audit_topic_id,
        transferStatus: inv.transfer_status,
        transferTxId: inv.transfer_tx_id,
        kycStatus: inv.kyc_status,
        deployedAt: prop.deployed_at,
      };
    }).filter(Boolean);

    totalDistributions = (distributions || [])
      .filter((d: any) => d.status === "paid")
      .reduce((sum: number, d: any) => sum + Number(d.amount_usd), 0);

    return NextResponse.json({
      portfolio: {
        totalValue: Math.round(totalValue),
        propertyCount: enrichedProperties.length,
        totalDistributions: Math.round(totalDistributions * 100) / 100,
        ownershipSummary: enrichedProperties.map((p: any) => ({
          name: p.name,
          percentage: p.myPercentage,
          value: p.myValue,
        })),
      },
      properties: enrichedProperties,
      distributions: distributions || [],
      auditEntries: auditEntries || [],
    });
  } catch (err) {
    console.error("LP dashboard error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
