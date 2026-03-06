import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { transferShares, grantTokenKyc, logAuditEntry, formatTxUrlSafe } from "@/lib/hedera/engine";
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
  // Rate limit: 10 transfers per IP per hour (persistent — cross-instance)
  const blocked = applyRateLimit(req.headers, "transfer", { max: 10, windowSec: 3600, persistent: true });
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

    // ── COMPLIANCE GATE ─────────────────────────────────────
    // Enforce KYC + accreditation requirements before any transfer.

    // Check 1: Issuer must have certified compliance
    if (!property.issuer_certified) {
      return NextResponse.json({
        error: "Issuer has not certified compliance for this property. Go to property settings and complete the Issuer Certification before transferring tokens.",
      }, { status: 403 });
    }

    // Check 2: KYC must be verified (if required by offering type)
    const requiresKyc = (property as any).requires_kyc !== false; // default true
    if (requiresKyc && investor.kyc_status !== "verified") {
      return NextResponse.json({
        error: `Investor ${investor.name} has not passed KYC verification. Current status: ${investor.kyc_status}. Verify their identity before transferring tokens.`,
      }, { status: 403 });
    }

    // Check 3: Accreditation must be verified (if required by offering type)
    const requiresAccreditation = (property as any).requires_accreditation === true;
    if (requiresAccreditation) {
      const accStatus = (investor as any).accreditation_status || "none";
      if (accStatus !== "verified") {
        return NextResponse.json({
          error: `This is a ${(property as any).offering_type || "506c"} offering requiring accredited investors. ${investor.name}'s accreditation status: ${accStatus}. Verify accreditation before transferring tokens.`,
        }, { status: 403 });
      }

      // Check accreditation expiry
      const accExpiry = (investor as any).accreditation_expiry;
      if (accExpiry && new Date(accExpiry) < new Date()) {
        return NextResponse.json({
          error: `${investor.name}'s accreditation has expired (${new Date(accExpiry).toLocaleDateString()}). Re-verify before transferring tokens.`,
        }, { status: 403 });
      }
    }
    // ── END COMPLIANCE GATE ─────────────────────────────────

    // Mark as pending
    await supabaseAdmin
      .from("ds_investors")
      .update({ transfer_status: "pending" } as any)
      .eq("id", investorId);

    // ── Grant on-chain KYC before transfer ─────────────────
    // Tokens are created with freezeDefault=true and KYC Key enabled.
    // We must grant KYC to the investor's wallet before they can receive tokens.
    if (property.share_token_id && investor.wallet_address) {
      const kycResult = await grantTokenKyc(
        property.share_token_id,
        investor.wallet_address,
        property.network as "mainnet" | "testnet"
      );

      if (!kycResult.ok) {
        // KYC already granted is fine (e.g., re-transfer attempt)
        const isAlreadyGranted = kycResult.error?.includes("TOKEN_HAS_NO_KYC_KEY") ||
          kycResult.error?.includes("ACCOUNT_KYC_ALREADY_GRANTED");
        if (!isAlreadyGranted) {
          // Log the grant failure
          await supabaseAdmin.from("ds_audit_entries").insert({
            property_id: property.id,
            action: "KYC_GRANT_FAILED",
            details: `Failed to grant on-chain KYC for ${investor.name} (${investor.wallet_address}): ${kycResult.error}`,
          } as any);

          return NextResponse.json({
            ok: false,
            error: `Failed to grant on-chain KYC for wallet ${investor.wallet_address}. The token requires KYC approval before transfers.`,
          }, { status: 400 });
        }
      } else {
        // Log successful KYC grant
        await supabaseAdmin.from("ds_audit_entries").insert({
          property_id: property.id,
          action: "KYC_GRANTED",
          details: `On-chain KYC granted for ${investor.name} (${investor.wallet_address})`,
          tx_id: kycResult.txId || null,
        } as any);

        // Log to HCS
        if (property.audit_topic_id) {
          await logAuditEntry(property.audit_topic_id, "KYC_GRANTED", {
            investor: investor.name,
            wallet: investor.wallet_address,
            shareToken: property.share_token_id,
            txId: kycResult.txId,
          }, property.network as "mainnet" | "testnet").catch(() => {});
        }

        // Update token permissions table (if it exists)
        try {
          await supabaseAdmin.from("ds_token_permissions").upsert({
            investor_id: investor.id,
            property_id: property.id,
            token_id: property.share_token_id,
            wallet_address: investor.wallet_address,
            kyc_status: "granted",
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            kyc_grant_tx_id: kycResult.txId,
          } as any, { onConflict: "investor_id,token_id" });
        } catch {};
      }
    }

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

      // Sanitize error message — don't leak raw Hedera SDK internals
      const safeError = result.error?.includes("not found on")
        ? result.error  // account-not-found is safe to show
        : result.error?.includes("has not associated")
        ? result.error  // association hint is useful
        : "Token transfer failed. Check the wallet address and token association.";

      return NextResponse.json({
        ok: false,
        error: safeError,
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
