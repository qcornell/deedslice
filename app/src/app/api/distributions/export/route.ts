import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/distributions/export?propertyId=xxx
 *
 * Export distributions as CSV. Operator-only.
 */
export async function GET(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "distributions-export", { max: 20, windowSec: 300 });
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
      .select("id, owner_id, name")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    // Load distributions
    const { data: distributions } = await supabaseAdmin
      .from("ds_distributions")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    // Load investors for name lookup
    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, wallet_address")
      .eq("property_id", propertyId);

    const investorMap = new Map((investors || []).map((i: any) => [i.id, i]));

    // Build CSV
    const headers = ["Date", "Investor", "Email", "Wallet", "Amount (USD)", "Type", "Period", "Status", "TX ID", "Paid At", "Notes"];
    const rows = (distributions || []).map((d: any) => {
      const inv = investorMap.get(d.investor_id) as any;
      return [
        new Date(d.created_at).toISOString().split("T")[0],
        inv?.name || "Unknown",
        inv?.email || "",
        inv?.wallet_address || "",
        Number(d.amount_usd).toFixed(2),
        d.type || "distribution",
        d.period || "",
        d.status,
        d.tx_id || "",
        d.paid_at ? new Date(d.paid_at).toISOString().split("T")[0] : "",
        (d.notes || "").replace(/"/g, '""'),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const propertyName = (prop as any).name.replace(/[^a-zA-Z0-9]/g, "_");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="distributions_${propertyName}_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err) {
    console.error("Distribution export error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
