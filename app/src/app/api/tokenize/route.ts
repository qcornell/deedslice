import { NextRequest, NextResponse } from "next/server";
import { tokenizeProperty } from "@/lib/hedera/engine";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { sendTokenizationEmail } from "@/lib/email";
import { applyRateLimitAsync } from "@/lib/rate-limit";
import { fireWebhooks } from "@/lib/webhooks";
import { sanitizePropertyName, sanitizeAddress, sanitizeText, sanitizePositiveNumber, sanitizePositiveInteger } from "@/lib/sanitize";
import type { Profile, Property } from "@/types/database";

export async function POST(req: NextRequest) {
  // Rate limit: 3 tokenizations per IP per hour
  const blocked = await applyRateLimitAsync(req.headers, "tokenize", { max: 3, windowSec: 3600 });
  if (blocked) return blocked;

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
      const { data: newProfile } = await supabaseAdmin
        .from("ds_profiles")
        .insert({
          id: user.id,
          email: user.email || "",
          plan: "starter",
          properties_used: 0,
          properties_limit: 999,
          tokenization_credits: 0,
        } as any)
        .select()
        .single();
      profile = newProfile as Profile | null;
      if (!profile) {
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
      }
    }

    // Parse body first
    const body = await req.json();
    const { name: rawName, address: rawAddress, propertyType: rawType, valuationUsd: rawVal, totalSlices: rawSlices, description: rawDesc, imageUrl, network: requestedNetwork } = body;

    // Sanitize all user inputs
    const name = rawName ? sanitizePropertyName(rawName) : "";
    const address = rawAddress ? sanitizeAddress(rawAddress) : "";
    const propertyType = ["residential", "commercial", "land", "industrial", "mixed"].includes(rawType) ? rawType : "residential";
    const valuationUsd = sanitizePositiveNumber(rawVal);
    const totalSlices = sanitizePositiveInteger(rawSlices);
    const description = rawDesc ? sanitizeText(rawDesc) : "";

    if (!name || !valuationUsd || !totalSlices) {
      return NextResponse.json({ error: "Missing or invalid required fields: name, valuationUsd, totalSlices" }, { status: 400 });
    }

    if (totalSlices > 10_000_000) {
      return NextResponse.json({ error: "Total slices cannot exceed 10,000,000" }, { status: 400 });
    }

    // Determine deploy network
    // Sandbox (starter) → testnet only
    // Operator (pro) → mainnet by default, can choose testnet
    // Enterprise → mainnet by default, can choose testnet, unlimited tokenization
    let deployNetwork: "mainnet" | "testnet";
    if (profile.plan === "starter") {
      deployNetwork = "testnet";
    } else if (requestedNetwork === "testnet") {
      deployNetwork = "testnet";
    } else {
      deployNetwork = "mainnet";
    }

    // Credit check: Operator on mainnet needs credits, Enterprise bypasses
    if (deployNetwork === "mainnet" && profile.plan === "pro") {
      const credits = (profile as any).tokenization_credits || 0;
      if (credits < 1) {
        return NextResponse.json({
          error: "No tokenization credits remaining. Purchase credits ($1,499/property or $4,999 for 5) in Settings to deploy on mainnet.",
        }, { status: 403 });
      }
    }
    // Enterprise: no credit check needed — unlimited mainnet tokenization

    if (profile.properties_used >= profile.properties_limit) {
      return NextResponse.json({ error: "Property limit reached. Contact support." }, { status: 403 });
    }

    const { data: propertyData, error: insertError } = await supabaseAdmin
      .from("ds_properties")
      .insert({
        owner_id: user.id,
        name,
        address: address || null,
        property_type: propertyType,
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

    // Deduct tokenization credit for Operator mainnet deployments
    // Enterprise does NOT deduct — unlimited tokenization included
    const updatePayload: any = { properties_used: profile.properties_used + 1 };
    if (deployNetwork === "mainnet" && profile.plan === "pro") {
      const currentCredits = (profile as any).tokenization_credits || 0;
      if (currentCredits > 0) {
        updatePayload.tokenization_credits = currentCredits - 1;
      }
    }
    await supabaseAdmin
      .from("ds_profiles")
      .update(updatePayload)
      .eq("id", user.id);

    // Send tokenization confirmation email (fire and forget)
    sendTokenizationEmail(
      profile.email,
      name,
      property.id,
      deployNetwork,
      valuationUsd,
      totalSlices,
      result.nftTokenId!,
      result.shareTokenId!,
    ).catch((err) => console.error("Tokenization email failed:", err));

    // Fire webhooks (fire and forget)
    fireWebhooks(user.id, "property.tokenized", {
      propertyId: property.id,
      name,
      address: address || null,
      valuationUsd,
      totalSlices,
      network: deployNetwork,
      nftTokenId: result.nftTokenId,
      shareTokenId: result.shareTokenId,
      auditTopicId: result.auditTopicId,
      transactions: result.transactions,
    }).catch((err) => console.error("Webhook fire failed:", err));

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
