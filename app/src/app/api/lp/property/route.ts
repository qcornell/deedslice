import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyLpToken } from "@/lib/lp-auth";

/**
 * GET /api/lp/property?id=<property_id>
 *
 * Returns a single property with investor-specific data, distributions,
 * documents, and audit trail. Used by the LP portal property detail page.
 *
 * Auth: Bearer <lp-jwt-token>
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = verifyLpToken(token);
    if (!session) return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });

    const propertyId = req.nextUrl.searchParams.get("id");
    if (!propertyId) return NextResponse.json({ error: "Missing property id" }, { status: 400 });

    // Find the investor record for this LP + property
    // First by investor_id if present, then by email
    let investorRecord: any = null;

    if (session.investor_id) {
      const { data } = await supabaseAdmin
        .from("ds_investors")
        .select("*")
        .eq("id", session.investor_id)
        .eq("property_id", propertyId)
        .single();
      investorRecord = data;
    }

    if (!investorRecord) {
      const { data } = await supabaseAdmin
        .from("ds_investors")
        .select("*")
        .eq("email", session.email)
        .eq("property_id", propertyId)
        .single();
      investorRecord = data;
    }

    if (!investorRecord) {
      return NextResponse.json({ error: "Property not found in your portfolio" }, { status: 404 });
    }

    // Verify property belongs to this org
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("org_id", session.org_id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Parallel: distributions, documents, audit trail
    const [distributionsRes, documentsRes, auditRes] = await Promise.all([
      supabaseAdmin
        .from("ds_distributions")
        .select("*")
        .eq("investor_id", investorRecord.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("ds_documents")
        .select("id, property_id, label, document_type, file_name, file_size, sha256_hash, created_at")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("ds_audit_entries")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const pricePerSlice = property.valuation_usd / property.total_slices;
    const investmentValue = pricePerSlice * investorRecord.slices_owned;

    const totalDistributions = (distributionsRes.data || [])
      .filter((d: any) => d.status === "paid")
      .reduce((sum: number, d: any) => sum + Number(d.amount_usd), 0);

    return NextResponse.json({
      property: {
        propertyId: property.id,
        name: property.name,
        address: property.address,
        propertyType: property.property_type,
        imageUrl: property.image_url,
        description: property.description || null,
        status: property.status,
        network: property.network,
        valuation: property.valuation_usd,
        totalSlices: property.total_slices,
        mySlices: investorRecord.slices_owned,
        myPercentage: investorRecord.percentage,
        myValue: Math.round(investmentValue),
        pricePerSlice: Math.round(pricePerSlice),
        shareTokenId: property.share_token_id,
        shareTokenSymbol: property.share_token_symbol,
        nftTokenId: property.nft_token_id,
        auditTopicId: property.audit_topic_id,
        transferStatus: investorRecord.transfer_status,
        transferTxId: investorRecord.transfer_tx_id,
        kycStatus: investorRecord.kyc_status,
        deployedAt: property.deployed_at,
        totalDistributions: Math.round(totalDistributions * 100) / 100,
      },
      distributions: distributionsRes.data || [],
      documents: documentsRes.data || [],
      auditEntries: auditRes.data || [],
    });
  } catch (err) {
    console.error("LP property detail error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
