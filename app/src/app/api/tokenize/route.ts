import { NextRequest, NextResponse } from "next/server";
import { tokenizeProperty } from "@/lib/hedera/engine";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import type { Profile, Property } from "@/types/database";

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: profileData } = await supabaseAdmin
      .from("ds_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = profileData as Profile | null;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.plan === "starter" && profile.properties_used >= 1) {
      return NextResponse.json({ error: "Starter plan limited to 1 testnet property. Upgrade to Pro." }, { status: 403 });
    }
    if (profile.plan === "pro" && profile.properties_used >= 5) {
      return NextResponse.json({ error: "Pro plan limited to 5 properties. Upgrade to Enterprise." }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, propertyType, valuationUsd, totalSlices, description } = body;

    if (!name || !valuationUsd || !totalSlices) {
      return NextResponse.json({ error: "Missing required fields: name, valuationUsd, totalSlices" }, { status: 400 });
    }

    const { data: propertyData, error: insertError } = await supabaseAdmin
      .from("ds_properties")
      .insert({
        owner_id: user.id,
        name,
        address: address || null,
        property_type: propertyType || "residential",
        valuation_usd: valuationUsd,
        total_slices: totalSlices,
        description: description || null,
        status: "deploying",
        network: process.env.HEDERA_NETWORK === "mainnet" ? "mainnet" : "testnet",
      } as any)
      .select()
      .single();

    const property = propertyData as Property | null;

    if (insertError || !property) {
      return NextResponse.json({ error: "Failed to create property record" }, { status: 500 });
    }

    const result = await tokenizeProperty({
      name,
      address: address || "",
      propertyType: propertyType || "residential",
      valuationUsd,
      totalSlices,
      description,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("ds_properties")
        .update({ status: "failed" } as any)
        .eq("id", property.id);

      return NextResponse.json({ error: result.error, transactions: result.transactions }, { status: 500 });
    }

    await supabaseAdmin
      .from("ds_properties")
      .update({
        nft_token_id: result.nftTokenId,
        nft_serial: result.nftSerial,
        share_token_id: result.shareTokenId,
        share_token_symbol: result.shareTokenSymbol,
        audit_topic_id: result.auditTopicId,
        status: "live",
        deployed_at: new Date().toISOString(),
      } as any)
      .eq("id", property.id);

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: property.id,
      action: "PROPERTY_TOKENIZED",
      details: `Tokenized ${name} — ${totalSlices} slices @ $${Math.round(valuationUsd / totalSlices)}/slice`,
      tx_id: result.transactions[0]?.txId || null,
    } as any);

    await supabaseAdmin.from("ds_investors").insert({
      property_id: property.id,
      name: profile.full_name || profile.email,
      email: profile.email,
      slices_owned: totalSlices,
      percentage: 100,
    } as any);

    await supabaseAdmin
      .from("ds_profiles")
      .update({ properties_used: profile.properties_used + 1 } as any)
      .eq("id", user.id);

    return NextResponse.json({
      ok: true,
      propertyId: property.id,
      ...result,
    });
  } catch (err) {
    console.error("Tokenize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
