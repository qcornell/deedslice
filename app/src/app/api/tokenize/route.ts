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

    let profile = profileData as Profile | null;

    if (!profile) {
      // Auto-create profile for users who signed up via Supabase Auth directly
      const { data: newProfile } = await supabaseAdmin
        .from("ds_profiles")
        .insert({
          id: user.id,
          email: user.email || "",
          plan: "starter",
          properties_used: 0,
          properties_limit: 1,
        } as any)
        .select()
        .single();
      profile = newProfile as Profile | null;
      if (!profile) {
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
      }
    }

    if (profile.properties_used >= profile.properties_limit) {
      const upgradeMsg = profile.plan === "starter"
        ? "Starter plan allows 1 free property (testnet). Upgrade to Pro for mainnet and up to 5 properties."
        : profile.plan === "pro"
        ? "Pro plan limited to 5 properties. Upgrade to Enterprise for unlimited."
        : "You've reached your property limit. Contact support.";
      return NextResponse.json({ error: upgradeMsg }, { status: 403 });
    }

    const body = await req.json();
    const { name, address, propertyType, valuationUsd, totalSlices, description, imageUrl } = body;

    if (!name || !valuationUsd || !totalSlices) {
      return NextResponse.json({ error: "Missing required fields: name, valuationUsd, totalSlices" }, { status: 400 });
    }

    // Starter plan → testnet sandbox, Pro+ → mainnet
    const deployNetwork: "mainnet" | "testnet" =
      profile.plan === "starter" ? "testnet" : "mainnet";

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
        image_url: imageUrl || null,
        status: "deploying",
        network: deployNetwork,
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
      network: deployNetwork,
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
      ...result,
      ok: true,
      propertyId: property.id,
    });
  } catch (err) {
    console.error("Tokenize error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
