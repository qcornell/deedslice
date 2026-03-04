import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";

interface ActionItem {
  icon: string;
  text: string;
  priority: "red" | "yellow" | "green";
  link?: string;
}

export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const rateLimitRes = applyRateLimit(req.headers, "action-items", { max: 60, windowSec: 60 });
    if (rateLimitRes) return rateLimitRes;

    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Get all user's properties
    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("id, name, filing_due_date")
      .eq("owner_id", user.id);

    if (!properties || properties.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const propertyIds = properties.map((p: any) => p.id);
    const items: ActionItem[] = [];

    // 1. Pending KYC — investors where kyc_status != 'verified'
    const { count: pendingKycCount } = await supabaseAdmin
      .from("ds_investors")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .neq("kyc_status", "verified");

    if (pendingKycCount && pendingKycCount > 0) {
      items.push({
        icon: "🔴",
        text: `${pendingKycCount} investor${pendingKycCount !== 1 ? "s" : ""} with incomplete KYC verification`,
        priority: "red",
      });
    }

    // 2. Stale distributions — properties with no distribution in 90+ days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const ninetyDaysAgoISO = ninetyDaysAgo.toISOString();

    const { data: recentDists } = await supabaseAdmin
      .from("ds_distributions")
      .select("property_id, created_at")
      .in("property_id", propertyIds)
      .gte("created_at", ninetyDaysAgoISO);

    const propertiesWithRecentDist = new Set(
      (recentDists || []).map((d: any) => d.property_id)
    );

    // Only flag properties that have investors (no point warning about distributions for empty properties)
    const { data: investorCounts } = await supabaseAdmin
      .from("ds_investors")
      .select("property_id")
      .in("property_id", propertyIds);

    const propertiesWithInvestors = new Set(
      (investorCounts || []).map((i: any) => i.property_id)
    );

    for (const prop of properties) {
      if (propertiesWithInvestors.has(prop.id) && !propertiesWithRecentDist.has(prop.id)) {
        // Check if there are ANY distributions for this property
        const { count: totalDists } = await supabaseAdmin
          .from("ds_distributions")
          .select("id", { count: "exact", head: true })
          .eq("property_id", prop.id);

        if (totalDists && totalDists > 0) {
          items.push({
            icon: "🟡",
            text: `"${prop.name}" has no distributions in the last 90 days`,
            priority: "yellow",
            link: `/dashboard/property/${prop.id}`,
          });
        }
      }
    }

    // 3. Missing wallet — investors with no wallet_address
    const { count: missingWalletCount } = await supabaseAdmin
      .from("ds_investors")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .is("wallet_address", null);

    if (missingWalletCount && missingWalletCount > 0) {
      items.push({
        icon: "🟡",
        text: `${missingWalletCount} investor${missingWalletCount !== 1 ? "s" : ""} missing a wallet address`,
        priority: "yellow",
      });
    }

    // 4. No investors — properties with zero investors
    for (const prop of properties) {
      if (!propertiesWithInvestors.has(prop.id)) {
        items.push({
          icon: "🟢",
          text: `"${prop.name}" has no investors yet`,
          priority: "green",
          link: `/dashboard/property/${prop.id}`,
        });
      }
    }

    // 5. Compliance filing dates
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    for (const prop of properties) {
      if (prop.filing_due_date) {
        const dueDate = new Date(prop.filing_due_date);
        if (dueDate < now) {
          items.push({
            icon: "🔴",
            text: `"${prop.name}" compliance filing is past due (${dueDate.toLocaleDateString()})`,
            priority: "red",
            link: `/dashboard/property/${prop.id}`,
          });
        } else if (dueDate <= thirtyDaysFromNow) {
          items.push({
            icon: "🔴",
            text: `"${prop.name}" compliance filing due ${dueDate.toLocaleDateString()}`,
            priority: "red",
            link: `/dashboard/property/${prop.id}`,
          });
        }
      }
    }

    // Sort: red first, then yellow, then green
    const priorityOrder = { red: 0, yellow: 1, green: 2 };
    items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Action items error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
