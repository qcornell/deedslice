import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { transferShares, logAuditEntry, formatTxUrlSafe } from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";
import { fireWebhooks } from "@/lib/webhooks";
import type { Property, Investor } from "@/types/database";

/**
 * POST /api/investors/transfer
 *
 * Transfer share tokens from DeedSlice treasury to an investor's Hedera wallet.
 *
 * Body: { investorId: string }
 *
 * Requirements:
 *   - Investor must have a wallet_address set
 *   - Investor must have associated the share token in their wallet
 *   - Property must be "live" with a share_token_id
 *   - Transfer must not have already been completed
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 transfers per IP per hour
  const blocked = applyRateLimit(req.headers, "transfer", { max: 10, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { investorId } = await req.json();

    if (!investorId) {
      return NextResponse.json({ error: "Missing investorId" }, { status: 400 });
    }

    // Load investor
    const { data: investorData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("id", investorId)
      .single();

    const investor = investorData as Investor | null;

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    // Load property + verify ownership
    const { data: propertyData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", investor.property_id)
      .eq("owner_id", user.id)
      .single();

    const property = propertyData as Property | null;

    if (!property) {
      return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });
    }

    // Validations
    if (property.status !== "live") {
      return NextResponse.json({ error: "Property is not live. Tokenize it first." }, { status: 400 });
    }

    if (!property.share_token_id) {
      return NextResponse.json({ error: "Property has no share token. Something went wrong during tokenization." }, { status: 400 });
    }

    if (!investor.wallet_address) {
      return NextResponse.json({ error: "Investor has no wallet address. Add their Hedera account ID first." }, { status: 400 });
    }

    if (investor.transfer_status === "transferred") {
      return NextResponse.json({ error: "Tokens have already been transferred to this investor." }, { status: 400 });
    }

    // Validate wallet address format (basic check: 0.0.XXXXX)
    const walletRegex = /^0\.0\.\d+$/;
    if (!walletRegex.test(investor.wallet_address)) {
      return NextResponse.json({ error: `Invalid Hedera account ID format: ${investor.wallet_address}. Expected format: 0.0.XXXXX` }, { status: 400 });
    }

    // Mark as pending
    await supabaseAdmin
      .from("ds_investors")
      .update({ transfer_status: "pending" } as any)
      .eq("id", investorId);

    // Execute the transfer
    const result = await transferShares({
      shareTokenId: property.share_token_id,
      recipientAccountId: investor.wallet_address,
      amount: investor.slices_owned,
      network: property.network as "mainnet" | "testnet",
    });

    if (!result.ok) {
      // Mark as failed
      await supabaseAdmin
        .from("ds_investors")
        .update({ transfer_status: "failed" } as any)
        .eq("id", investorId);

      // Log failure to audit
      if (property.audit_topic_id) {
        await logAuditEntry(property.audit_topic_id, "TRANSFER_FAILED", {
          investor: investor.name,
          wallet: investor.wallet_address,
          slices: investor.slices_owned,
          error: result.error,
        }, property.network as "mainnet" | "testnet");
      }

      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: property.id,
        action: "TRANSFER_FAILED",
        details: `Failed to transfer ${investor.slices_owned} slices to ${investor.name} (${investor.wallet_address}): ${result.error}`,
      } as any);

      return NextResponse.json({
        ok: false,
        error: result.error,
      }, { status: 400 });
    }

    // Mark as transferred
    await supabaseAdmin
      .from("ds_investors")
      .update({
        transfer_status: "transferred",
        transfer_tx_id: result.txId,
        transferred_at: new Date().toISOString(),
      } as any)
      .eq("id", investorId);

    // Log to HCS audit trail
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "TOKENS_TRANSFERRED", {
        investor: investor.name,
        wallet: investor.wallet_address,
        slices: investor.slices_owned,
        shareToken: property.share_token_id,
        txId: result.txId,
      }, property.network as "mainnet" | "testnet");
    }

    // Log to local audit table
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: property.id,
      action: "TOKENS_TRANSFERRED",
      details: `Transferred ${investor.slices_owned} slices to ${investor.name} (${investor.wallet_address})`,
      tx_id: result.txId,
    } as any);

    // Fire webhooks (fire and forget)
    fireWebhooks(user.id, "transfer.completed", {
      propertyId: property.id,
      investorId: investor.id,
      investorName: investor.name,
      wallet: investor.wallet_address,
      slices: investor.slices_owned,
      shareTokenId: property.share_token_id,
      txId: result.txId,
      network: property.network,
    }).catch((err) => console.error("Webhook fire failed:", err));

    return NextResponse.json({
      ok: true,
      txId: result.txId,
      explorerUrl: result.explorerUrl,
      investor: investor.name,
      slices: investor.slices_owned,
      wallet: investor.wallet_address,
    });
  } catch (err) {
    console.error("Transfer error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
