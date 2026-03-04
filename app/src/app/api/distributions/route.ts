import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";
import { fireWebhooks } from "@/lib/webhooks";
import { sendDistributionEmail } from "@/lib/email";
import type { Property, Investor, Distribution } from "@/types/database";

/**
 * GET /api/distributions?propertyId=xxx
 *
 * List distributions for a property. Operator-only.
 */
export async function GET(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "distributions-list", { max: 60, windowSec: 60 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });

    // Verify ownership
    const { data: prop } = await supabaseAdmin
      .from("ds_properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    // Pagination
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || "50")));
    const offset = (page - 1) * limit;

    // Load distributions with investor names
    const { data: distributions, count } = await supabaseAdmin
      .from("ds_distributions")
      .select("*", { count: "exact" })
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Load investors for name lookup
    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email")
      .eq("property_id", propertyId);

    const investorMap = new Map((investors || []).map((i: any) => [i.id, i]));

    const enriched = (distributions || []).map((d: any) => ({
      ...d,
      investor_name: (investorMap.get(d.investor_id) as any)?.name || "Unknown",
      investor_email: (investorMap.get(d.investor_id) as any)?.email || null,
    }));

    return NextResponse.json({
      distributions: enriched,
      pagination: { page, limit, total: count ?? enriched.length, pages: Math.ceil((count ?? enriched.length) / limit) },
    });
  } catch (err) {
    console.error("Distributions list error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/distributions
 *
 * Create a single distribution record for one investor.
 *
 * Body: { propertyId, investorId, amountUsd, type?, period?, notes? }
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "distributions-create", { max: 30, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { propertyId, investorId, amountUsd, type, period, notes } = body;

    if (!propertyId || !investorId || !amountUsd) {
      return NextResponse.json({ error: "Missing required fields: propertyId, investorId, amountUsd" }, { status: 400 });
    }

    if (Number(amountUsd) <= 0) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // Load property + verify ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    const property = propData as Property | null;
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    // Load investor
    const { data: invData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("id", investorId)
      .eq("property_id", propertyId)
      .single();

    const investor = invData as Investor | null;
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 });

    // Create distribution
    const { data: dist, error: insertErr } = await supabaseAdmin
      .from("ds_distributions")
      .insert({
        property_id: propertyId,
        investor_id: investorId,
        amount_usd: Number(amountUsd),
        type: type || "distribution",
        period: period || null,
        status: "pending",
        notes: notes || null,
      } as any)
      .select()
      .single();

    if (insertErr || !dist) {
      return NextResponse.json({ error: "Failed to create distribution" }, { status: 500 });
    }

    // Email investor (fire and forget)
    if (investor.email) {
      sendDistributionEmail(
        investor.email,
        investor.name,
        property.name,
        Number(amountUsd),
        period || null,
        type || "distribution",
      ).catch(err => console.error(`Distribution email failed:`, err));
    }

    // Audit log
    const auditDetails = `Distribution recorded: $${Number(amountUsd).toFixed(2)} to ${investor.name}${period ? ` (${period})` : ""}`;

    if (property.audit_topic_id) {
      logAuditEntry(property.audit_topic_id, "DISTRIBUTION_RECORDED", {
        investor: investor.name,
        investorId: investor.id,
        amount: Number(amountUsd),
        type: type || "distribution",
        period: period || null,
      }, property.network as "mainnet" | "testnet").catch(err => console.error("HCS audit error:", err));
    }

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: "DISTRIBUTION_RECORDED",
      details: auditDetails,
    } as any);

    return NextResponse.json({ distribution: dist });
  } catch (err) {
    console.error("Distribution create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/distributions
 *
 * Update a distribution's status (pending → paid / failed).
 *
 * Body: { distributionId, status, txId?, notes? }
 */
export async function PATCH(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "distributions-update", { max: 30, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { distributionId, status, txId, notes } = body;

    if (!distributionId || !status) {
      return NextResponse.json({ error: "Missing distributionId and status" }, { status: 400 });
    }

    if (!["pending", "paid", "failed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be: pending, paid, or failed" }, { status: 400 });
    }

    // Load distribution
    const { data: distData } = await supabaseAdmin
      .from("ds_distributions")
      .select("*")
      .eq("id", distributionId)
      .single();

    if (!distData) return NextResponse.json({ error: "Distribution not found" }, { status: 404 });
    const dist = distData as any;

    // Load property to verify ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("id, owner_id, audit_topic_id, network")
      .eq("id", dist.property_id)
      .single();

    if (!propData || (propData as any).owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    const prop = propData as any;

    // Update
    const updatePayload: any = { status };
    if (txId) updatePayload.tx_id = txId;
    if (notes) updatePayload.notes = notes;
    if (status === "paid") updatePayload.paid_at = new Date().toISOString();

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("ds_distributions")
      .update(updatePayload)
      .eq("id", distributionId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: "Failed to update distribution" }, { status: 500 });
    }

    // Audit log for status change
    if (status === "paid" && prop.audit_topic_id) {
      const { data: inv } = await supabaseAdmin
        .from("ds_investors")
        .select("name")
        .eq("id", dist.investor_id)
        .single();

      const investorName = (inv as any)?.name || "Unknown";

      logAuditEntry(prop.audit_topic_id, "DISTRIBUTION_PAID", {
        investor: investorName,
        amount: dist.amount_usd,
        period: dist.period,
        txId: txId || null,
      }, prop.network as "mainnet" | "testnet").catch(err => console.error("HCS audit error:", err));

      await supabaseAdmin.from("ds_audit_entries").insert({
        property_id: dist.property_id,
        action: "DISTRIBUTION_PAID",
        details: `$${Number(dist.amount_usd).toFixed(2)} paid to ${investorName}${dist.period ? ` (${dist.period})` : ""}`,
      } as any);

      // Fire webhooks
      fireWebhooks(user.id, "distribution.paid", {
        propertyId: dist.property_id,
        distributionId,
        investorId: dist.investor_id,
        investorName,
        amount: dist.amount_usd,
        period: dist.period,
        txId: txId || null,
      }).catch(() => {});
    }

    return NextResponse.json({ distribution: updated });
  } catch (err) {
    console.error("Distribution update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
