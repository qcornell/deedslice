import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { sendInvestorAddedEmail } from "@/lib/email";
import { sanitizeText, sanitizeEmail, sanitizeAccountId, sanitizePositiveInteger } from "@/lib/sanitize";
import type { Property } from "@/types/database";

/** POST /api/investors — add or update an investor for a property */
export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const propertyId = body.propertyId;
    const name = body.name ? sanitizeText(body.name, 200) : "";
    const email = body.email ? sanitizeEmail(body.email) : null;
    const walletAddress = body.walletAddress ? sanitizeAccountId(body.walletAddress) : null;
    const slicesOwned = sanitizePositiveInteger(body.slicesOwned);

    if (!propertyId || !name || !slicesOwned) {
      return NextResponse.json({ error: "Missing required fields: propertyId, name, slicesOwned" }, { status: 400 });
    }

    if (body.walletAddress && !walletAddress) {
      return NextResponse.json({ error: "Invalid wallet address format. Expected: 0.0.XXXXX" }, { status: 400 });
    }

    if (body.email && !email) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    const property = data as Property | null;

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const percentage = Math.round((slicesOwned / property.total_slices) * 10000) / 100;

    const { data: existingInvestors } = await supabaseAdmin
      .from("ds_investors")
      .select("slices_owned")
      .eq("property_id", propertyId);

    const currentTotal = (existingInvestors || []).reduce((sum: number, i: any) => sum + i.slices_owned, 0);
    if (currentTotal + slicesOwned > property.total_slices) {
      return NextResponse.json({
        error: `Only ${property.total_slices - currentTotal} slices available (${property.total_slices} total, ${currentTotal} allocated)`,
      }, { status: 400 });
    }

    const { data: investor, error: insertError } = await supabaseAdmin
      .from("ds_investors")
      .insert({
        property_id: propertyId,
        name,
        email: email || null,
        wallet_address: walletAddress || null,
        slices_owned: slicesOwned,
        percentage,
      } as any)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to add investor" }, { status: 500 });
    }

    // Recalculate all investor percentages in a single query
    // instead of N individual UPDATE statements
    await supabaseAdmin.rpc("recalculate_investor_percentages", {
      p_property_id: propertyId,
      p_total_slices: property.total_slices,
    }).then(({ error: rpcErr }) => {
      if (rpcErr) {
        // Fallback to individual updates if RPC not deployed
        console.warn("Percentage recalc RPC not available, using fallback:", rpcErr.message);
        return supabaseAdmin
          .from("ds_investors")
          .select("id, slices_owned")
          .eq("property_id", propertyId)
          .then(async ({ data: allInvestors }) => {
            if (allInvestors) {
              for (const inv of allInvestors) {
                const pct = Math.round(((inv as any).slices_owned / property.total_slices) * 10000) / 100;
                await supabaseAdmin
                  .from("ds_investors")
                  .update({ percentage: pct } as any)
                  .eq("id", (inv as any).id);
              }
            }
          });
      }
    });

    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "INVESTOR_ADDED", {
        investor: name,
        slices: slicesOwned,
        percentage,
      }, property.network as "mainnet" | "testnet");
    }

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: "INVESTOR_ADDED",
      details: `${name} allocated ${slicesOwned} slices (${percentage}%)`,
    } as any);

    // Notify property owner via email (fire and forget)
    const ownerEmail = user.email;
    if (ownerEmail) {
      sendInvestorAddedEmail(
        ownerEmail,
        property.name,
        propertyId,
        name,
        slicesOwned,
        percentage,
      ).catch((err) => console.error("Investor email failed:", err));
    }

    return NextResponse.json({ ok: true, investor });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
