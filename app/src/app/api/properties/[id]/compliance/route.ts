import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import {
  grantTokenKyc,
  revokeTokenKyc,
  freezeTokenAccount,
  unfreezeTokenAccount,
  pauseToken,
  unpauseToken,
  logAuditEntry,
} from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/properties/[id]/compliance — Execute compliance actions
 *
 * Body: {
 *   action: "grant_kyc" | "revoke_kyc" | "freeze" | "unfreeze" | "pause_token" | "unpause_token",
 *   investorId?: string,   // required for investor-level actions
 *   reason?: string,
 * }
 *
 * This endpoint handles all on-chain compliance operations and logs
 * every action to both the database and HCS audit trail.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const blocked = applyRateLimit(req.headers, "compliance", { max: 20, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const propertyId = params.id;
    const body = await req.json();
    const { action, investorId, reason } = body;

    // Load property + verify ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!propData) {
      return NextResponse.json({ error: "Property not found or access denied" }, { status: 404 });
    }

    const property = propData as any;

    if (!property.share_token_id) {
      return NextResponse.json({ error: "Property has no share token" }, { status: 400 });
    }

    // ── Token-level actions (pause/unpause) ──────────────────
    if (action === "pause_token") {
      const result = await pauseToken(property.share_token_id, property.network);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: propertyId,
        action: "TOKEN_PAUSED",
        details: `Emergency pause on ${property.share_token_symbol || property.share_token_id}${reason ? `: ${reason}` : ""}`,
        tx_id: result.txId,
      } as any);

      if (property.audit_topic_id) {
        await logAuditEntry(property.audit_topic_id, "TOKEN_PAUSED", {
          tokenId: property.share_token_id,
          reason: reason || "Emergency pause by operator",
          txId: result.txId,
        }, property.network).catch(() => {});
      }

      return NextResponse.json({ ok: true, action: "pause_token", txId: result.txId });
    }

    if (action === "unpause_token") {
      const result = await unpauseToken(property.share_token_id, property.network);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
      }

      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: propertyId,
        action: "TOKEN_UNPAUSED",
        details: `Resumed operations on ${property.share_token_symbol || property.share_token_id}${reason ? `: ${reason}` : ""}`,
        tx_id: result.txId,
      } as any);

      if (property.audit_topic_id) {
        await logAuditEntry(property.audit_topic_id, "TOKEN_UNPAUSED", {
          tokenId: property.share_token_id,
          reason: reason || "Resumed by operator",
          txId: result.txId,
        }, property.network).catch(() => {});
      }

      return NextResponse.json({ ok: true, action: "unpause_token", txId: result.txId });
    }

    // ── Investor-level actions (require investorId) ──────────
    if (!investorId) {
      return NextResponse.json({ error: "investorId required for this action" }, { status: 400 });
    }

    const { data: invData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("id", investorId)
      .eq("property_id", propertyId)
      .single();

    if (!invData) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    const investor = invData as any;

    if (!investor.wallet_address) {
      return NextResponse.json({ error: "Investor has no wallet address" }, { status: 400 });
    }

    let result: { ok: boolean; txId?: string; error?: string };
    let auditAction: string;
    let auditDetails: string;
    let kycStatusUpdate: string | null = null;
    let freezeStatusUpdate: string | null = null;

    switch (action) {
      case "grant_kyc":
        result = await grantTokenKyc(property.share_token_id, investor.wallet_address, property.network);
        auditAction = "KYC_GRANTED";
        auditDetails = `On-chain KYC granted for ${investor.name} (${investor.wallet_address})`;
        kycStatusUpdate = "granted";
        break;

      case "revoke_kyc":
        result = await revokeTokenKyc(property.share_token_id, investor.wallet_address, property.network);
        auditAction = "KYC_REVOKED";
        auditDetails = `On-chain KYC revoked for ${investor.name} (${investor.wallet_address})${reason ? `: ${reason}` : ""}`;
        kycStatusUpdate = "revoked";
        break;

      case "freeze":
        result = await freezeTokenAccount(property.share_token_id, investor.wallet_address, property.network);
        auditAction = "ACCOUNT_FROZEN";
        auditDetails = `Account frozen for ${investor.name} (${investor.wallet_address})${reason ? `: ${reason}` : ""}`;
        freezeStatusUpdate = "frozen";
        break;

      case "unfreeze":
        result = await unfreezeTokenAccount(property.share_token_id, investor.wallet_address, property.network);
        auditAction = "ACCOUNT_UNFROZEN";
        auditDetails = `Account unfrozen for ${investor.name} (${investor.wallet_address})`;
        freezeStatusUpdate = "unfrozen";
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    if (!result.ok) {
      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: propertyId,
        action: `${auditAction!}_FAILED`,
        details: `Failed: ${auditDetails!} — ${result.error}`,
      } as any);

      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    // Log success to DB
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: auditAction!,
      details: auditDetails!,
      tx_id: result.txId,
    } as any);

    // Log to HCS on-chain
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, auditAction!, {
        investor: investor.name,
        wallet: investor.wallet_address,
        tokenId: property.share_token_id,
        reason: reason || null,
        txId: result.txId,
      }, property.network).catch(() => {});
    }

    // Update token permissions table
    const permUpdate: any = {
      investor_id: investor.id,
      property_id: propertyId,
      token_id: property.share_token_id,
      wallet_address: investor.wallet_address,
    };
    if (kycStatusUpdate) {
      permUpdate.kyc_status = kycStatusUpdate;
      permUpdate[kycStatusUpdate === "granted" ? "kyc_grant_tx_id" : "kyc_revoke_tx_id"] = result.txId;
      if (kycStatusUpdate === "granted") {
        permUpdate.approved_by = user.id;
        permUpdate.approved_at = new Date().toISOString();
      }
    }
    if (freezeStatusUpdate) {
      permUpdate.freeze_status = freezeStatusUpdate;
      permUpdate[freezeStatusUpdate === "frozen" ? "freeze_tx_id" : "unfreeze_tx_id"] = result.txId;
    }

    try {
      await supabaseAdmin.from("ds_token_permissions")
        .upsert(permUpdate, { onConflict: "investor_id,token_id" });
    } catch {}

    return NextResponse.json({
      ok: true,
      action,
      investor: investor.name,
      wallet: investor.wallet_address,
      txId: result.txId,
    });
  } catch (err) {
    console.error("Compliance action error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
