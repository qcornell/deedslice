import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/demo/seed — Seed demo data for new users
 *
 * Creates a sample testnet property with investors, distributions,
 * documents (metadata only), and audit entries so new users
 * see a populated dashboard immediately.
 *
 * Only works once per user (checks for existing demo property).
 */

const DEMO_PROPERTY = {
  name: "123 Demo Street",
  address: "123 Demo St, Austin, TX 78701",
  property_type: "residential",
  valuation_usd: 450000,
  total_slices: 100,
  description: "Sample property to explore the DeedSlice platform. This is testnet data — nothing on-chain is real.",
  status: "live",
  network: "testnet",
  // Fake but realistic-looking testnet IDs
  nft_token_id: "0.0.demo-nft",
  nft_serial: 1,
  share_token_id: "0.0.demo-shares",
  share_token_symbol: "DEMO",
  audit_topic_id: "0.0.demo-audit",
  deployed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
};

const DEMO_INVESTORS = [
  { name: "Sarah Chen", email: "sarah@example.com", slices_owned: 100, percentage: 100, wallet_address: null, transfer_status: null },
];

const DEMO_AUDIT_ENTRIES = [
  {
    action: "PROPERTY_TOKENIZED",
    details: "Tokenized 123 Demo Street — 100 slices @ $4,500/slice",
    offset_days: 7,
  },
  {
    action: "INVESTOR_ADDED",
    details: "Sarah Chen allocated 25 slices (25%)",
    offset_days: 6,
  },
  {
    action: "INVESTOR_ADDED",
    details: "James Rodriguez allocated 15 slices (15%)",
    offset_days: 5,
  },
  {
    action: "DOCUMENT_ADDED",
    details: "Property Deed (legal) — SHA-256: a1b2c3d4e5f6...",
    offset_days: 5,
  },
  {
    action: "DISTRIBUTION_RECORDED",
    details: "Batch distribution: $3,200.00 across 3 investors (February 2026)",
    offset_days: 2,
  },
  {
    action: "TOKENS_TRANSFERRED",
    details: "25 tokens transferred to Sarah Chen (0.0.example)",
    offset_days: 1,
  },
];

export async function POST(req: NextRequest) {
  const blocked = await applyRateLimitAsync(req.headers, "demo-seed", { max: 3, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Check if user already has a demo property
    const { data: existing } = await supabaseAdmin
      .from("ds_properties")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", DEMO_PROPERTY.name)
      .single();

    if (existing) {
      return NextResponse.json({ ok: true, message: "Demo data already exists", propertyId: (existing as any).id });
    }

    // Check if user already has ANY properties (don't clutter experienced users)
    const { data: anyProps } = await supabaseAdmin
      .from("ds_properties")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1);

    if (anyProps && anyProps.length > 0) {
      return NextResponse.json({ ok: true, message: "User already has properties, skipping demo" });
    }

    // Create demo property
    const { data: property, error: propError } = await supabaseAdmin
      .from("ds_properties")
      .insert({
        owner_id: user.id,
        ...DEMO_PROPERTY,
      } as any)
      .select()
      .single();

    if (propError || !property) {
      console.error("Demo property creation failed:", propError);
      return NextResponse.json({ error: "Failed to create demo property" }, { status: 500 });
    }

    const propId = (property as any).id;

    // Get user profile info
    const { data: profile } = await supabaseAdmin
      .from("ds_profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const ownerName = (profile as any)?.full_name || (profile as any)?.email || "Owner";

    // Create investors — owner gets 60%, two demo investors
    const investorPayloads = [
      {
        property_id: propId,
        name: ownerName,
        email: user.email || null,
        slices_owned: 60,
        percentage: 60,
        wallet_address: null,
        transfer_status: null,
      },
      {
        property_id: propId,
        name: "Sarah Chen",
        email: "sarah@example.com",
        slices_owned: 25,
        percentage: 25,
        wallet_address: "0.0.1234567",
        transfer_status: "transferred",
        transfer_tx_id: "0.0.demo@1234567890.000000000",
      },
      {
        property_id: propId,
        name: "James Rodriguez",
        email: "james@example.com",
        slices_owned: 15,
        percentage: 15,
        wallet_address: "0.0.7654321",
        transfer_status: "pending",
      },
    ];

    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .insert(investorPayloads as any)
      .select();

    // Create demo distributions
    const investorMap = new Map((investors || []).map((i: any) => [i.name, i.id]));
    const sarahId = investorMap.get("Sarah Chen");
    const jamesId = investorMap.get("James Rodriguez");
    const ownerId = investorMap.get(ownerName);

    if (sarahId && jamesId && ownerId) {
      const distPayloads = [
        {
          property_id: propId,
          investor_id: ownerId,
          amount_usd: 1920,
          type: "distribution",
          period: "February 2026",
          status: "paid",
          paid_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          property_id: propId,
          investor_id: sarahId,
          amount_usd: 800,
          type: "distribution",
          period: "February 2026",
          status: "paid",
          paid_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          property_id: propId,
          investor_id: jamesId,
          amount_usd: 480,
          type: "distribution",
          period: "February 2026",
          status: "recorded",
        },
      ];

      await supabaseAdmin.from("ds_distributions").insert(distPayloads as any);
    }

    // Create audit entries with staggered dates
    const auditPayloads = DEMO_AUDIT_ENTRIES.map(entry => ({
      property_id: propId,
      action: entry.action,
      details: entry.details,
      created_at: new Date(Date.now() - entry.offset_days * 24 * 60 * 60 * 1000).toISOString(),
    }));

    await supabaseAdmin.from("ds_audit_entries").insert(auditPayloads as any);

    return NextResponse.json({
      ok: true,
      message: "Demo data created successfully",
      propertyId: propId,
    });
  } catch (err) {
    console.error("Demo seed error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/demo/seed — Remove demo data
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: demoProp } = await supabaseAdmin
      .from("ds_properties")
      .select("id")
      .eq("owner_id", user.id)
      .eq("name", DEMO_PROPERTY.name)
      .single();

    if (!demoProp) return NextResponse.json({ ok: true, message: "No demo data found" });

    const propId = (demoProp as any).id;

    // Delete in order (foreign keys)
    await supabaseAdmin.from("ds_distributions").delete().eq("property_id", propId);
    await supabaseAdmin.from("ds_audit_entries").delete().eq("property_id", propId);
    await supabaseAdmin.from("ds_investors").delete().eq("property_id", propId);
    await supabaseAdmin.from("ds_properties").delete().eq("id", propId);

    return NextResponse.json({ ok: true, message: "Demo data removed" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
