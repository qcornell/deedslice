import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { applyRateLimit } from "@/lib/rate-limit";
import { fireWebhooks } from "@/lib/webhooks";
import { sendDistributionEmail } from "@/lib/email";
import type { Property, Investor } from "@/types/database";

/**
 * POST /api/distributions/batch
 *
 * Create distributions for ALL investors of a property, proportional to ownership.
 *
 * Body: {
 *   propertyId: string,
 *   totalAmount: number,       // total USD to distribute
 *   type?: string,             // "distribution" | "return_of_capital" | "other"
 *   period?: string,           // e.g. "Q1 2026", "March 2026"
 *   notes?: string,
 *   autoMarkPaid?: boolean,    // if true, mark as "paid" immediately (default: false → "pending")
 * }
 *
 * The total is split proportionally by each investor's percentage.
 * Rounding is handled so the sum always equals totalAmount (remainder goes to largest holder).
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "distributions-batch", { max: 10, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { propertyId, totalAmount, type, period, notes, autoMarkPaid } = body;

    if (!propertyId || !totalAmount) {
      return NextResponse.json({ error: "Missing required fields: propertyId, totalAmount" }, { status: 400 });
    }

    if (Number(totalAmount) <= 0) {
      return NextResponse.json({ error: "Total amount must be greater than 0" }, { status: 400 });
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

    if (property.status !== "live") {
      return NextResponse.json({ error: "Property must be live to create distributions" }, { status: 400 });
    }

    // Load investors
    const { data: investorsData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("property_id", propertyId)
      .order("slices_owned", { ascending: false });

    const investors = (investorsData || []) as Investor[];

    if (investors.length === 0) {
      return NextResponse.json({ error: "No investors found for this property" }, { status: 400 });
    }

    // Calculate proportional amounts
    const total = Number(totalAmount);
    const totalSlicesAllocated = investors.reduce((s, i) => s + i.slices_owned, 0);

    if (totalSlicesAllocated === 0) {
      return NextResponse.json({ error: "No slices allocated to investors" }, { status: 400 });
    }

    // Calculate each share, rounding to 2 decimal places
    const allocations = investors.map(inv => ({
      investorId: inv.id,
      investorName: inv.name,
      investorEmail: inv.email,
      slices: inv.slices_owned,
      percentage: inv.percentage,
      // Calculate from slices ratio (more precise than percentage which may be rounded)
      rawAmount: (inv.slices_owned / totalSlicesAllocated) * total,
      amount: 0, // will be set after rounding
    }));

    // Round all amounts, then fix any rounding error on the largest holder
    let roundedTotal = 0;
    for (const a of allocations) {
      a.amount = Math.round(a.rawAmount * 100) / 100; // round to cents
      roundedTotal += a.amount;
    }

    // Fix rounding discrepancy on the largest holder (first in list, sorted desc)
    const diff = Math.round((total - roundedTotal) * 100) / 100;
    if (diff !== 0 && allocations.length > 0) {
      allocations[0].amount = Math.round((allocations[0].amount + diff) * 100) / 100;
    }

    // Insert all distributions in one batch
    const status = autoMarkPaid ? "paid" : "pending";
    const now = new Date().toISOString();

    const inserts = allocations.map(a => ({
      property_id: propertyId,
      investor_id: a.investorId,
      amount_usd: a.amount,
      type: type || "distribution",
      period: period || null,
      status,
      notes: notes || null,
      paid_at: autoMarkPaid ? now : null,
    }));

    const { data: created, error: insertErr } = await supabaseAdmin
      .from("ds_distributions")
      .insert(inserts as any)
      .select();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Audit log
    const auditAction = autoMarkPaid ? "BATCH_DISTRIBUTION_PAID" : "BATCH_DISTRIBUTION_RECORDED";
    const auditDetails = `Batch ${type || "distribution"}: $${total.toLocaleString(undefined, { minimumFractionDigits: 2 })} across ${investors.length} investors${period ? ` (${period})` : ""}`;

    if (property.audit_topic_id) {
      logAuditEntry(property.audit_topic_id, auditAction, {
        totalAmount: total,
        investorCount: investors.length,
        type: type || "distribution",
        period: period || null,
        status,
        breakdown: allocations.map(a => ({
          investor: a.investorName,
          amount: a.amount,
          percentage: a.percentage,
        })),
      }, property.network as "mainnet" | "testnet").catch(err => console.error("HCS audit error:", err));
    }

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: auditAction,
      details: auditDetails,
    } as any);

    // Email investors (fire and forget)
    for (const a of allocations) {
      if (a.investorEmail) {
        sendDistributionEmail(
          a.investorEmail,
          a.investorName,
          property.name,
          a.amount,
          period || null,
          type || "distribution",
        ).catch(err => console.error(`Distribution email to ${a.investorEmail} failed:`, err));
      }
    }

    // Fire webhooks
    fireWebhooks(user.id, "distribution.batch", {
      propertyId,
      propertyName: property.name,
      totalAmount: total,
      investorCount: investors.length,
      type: type || "distribution",
      period: period || null,
      status,
      allocations: allocations.map(a => ({
        investorId: a.investorId,
        investorName: a.investorName,
        amount: a.amount,
        percentage: a.percentage,
      })),
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      totalAmount: total,
      investorCount: investors.length,
      status,
      period: period || null,
      allocations: allocations.map(a => ({
        investorId: a.investorId,
        investorName: a.investorName,
        amount: a.amount,
        percentage: a.percentage,
        slices: a.slices,
      })),
      distributions: created,
    });
  } catch (err) {
    console.error("Batch distribution error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
