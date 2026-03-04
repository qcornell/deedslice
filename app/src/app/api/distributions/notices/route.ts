import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import PDFDocument from "pdfkit";

export async function POST(req: NextRequest) {
  try {
    // Rate limit
    const rateLimitRes = applyRateLimit(req.headers, "distribution-notices", { max: 30, windowSec: 3600 });
    if (rateLimitRes) return rateLimitRes;

    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { propertyId, period } = await req.json();

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // Verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("id, name, address, total_slices, owner_id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Get distributions for this period
    let distQuery = supabaseAdmin
      .from("ds_distributions")
      .select("id, investor_id, amount_usd, period, created_at")
      .eq("property_id", propertyId);

    if (period) {
      distQuery = distQuery.eq("period", period);
    }

    const { data: distributions } = await distQuery;

    if (!distributions || distributions.length === 0) {
      return NextResponse.json({ error: "No distributions found for this period" }, { status: 404 });
    }

    // Get investor details
    const investorIds = Array.from(new Set(distributions.map((d: any) => d.investor_id)));
    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, slices_owned, percentage")
      .in("id", investorIds);

    const investorMap = new Map((investors || []).map((i: any) => [i.id, i]));

    const totalAmount = distributions.reduce((s: number, d: any) => s + Number(d.amount_usd), 0);
    const distributionDate = new Date(distributions[0].created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const effectivePeriod = period || distributions[0]?.period || "N/A";

    // Generate PDF
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "LETTER", margin: 60 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Group distributions by investor
      const investorDistributions = new Map<string, number>();
      for (const dist of distributions) {
        const current = investorDistributions.get(dist.investor_id) || 0;
        investorDistributions.set(dist.investor_id, current + Number(dist.amount_usd));
      }

      let isFirstPage = true;

      for (const [investorId, individualAmount] of investorDistributions) {
        const investor = investorMap.get(investorId);
        if (!investor) continue;

        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // Header
        doc
          .fontSize(18)
          .font("Helvetica-Bold")
          .text(property.name, { align: "center" });

        if (property.address) {
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#666666")
            .text(property.address, { align: "center" });
        }

        doc.moveDown(0.5);
        doc
          .strokeColor("#cccccc")
          .lineWidth(1)
          .moveTo(60, doc.y)
          .lineTo(552, doc.y)
          .stroke();

        doc.moveDown(1);

        // Date
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#333333")
          .text(`Date: ${distributionDate}`, { align: "right" });

        doc.moveDown(0.5);

        // Investor name
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#333333")
          .text(`To: ${investor.name}`);

        if (investor.email) {
          doc
            .fontSize(9)
            .fillColor("#666666")
            .text(investor.email);
        }

        doc.moveDown(1.5);

        // Title
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("#000000")
          .text("Distribution Notice", { align: "center" });

        doc.moveDown(1.5);

        // Details table-like layout
        const leftCol = 60;
        const rightCol = 300;
        let y = doc.y;

        const addRow = (label: string, value: string) => {
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#666666")
            .text(label, leftCol, y, { width: 230 });
          doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .fillColor("#333333")
            .text(value, rightCol, y, { width: 240 });
          y += 24;
        };

        addRow("Period:", effectivePeriod);
        addRow("Investment Shares Held:", `${investor.slices_owned.toLocaleString()} of ${property.total_slices.toLocaleString()}`);
        addRow("Ownership Percentage:", `${investor.percentage}%`);
        addRow("Total Property Distribution:", `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        y += 8;
        doc
          .strokeColor("#cccccc")
          .lineWidth(0.5)
          .moveTo(60, y)
          .lineTo(552, y)
          .stroke();
        y += 16;

        addRow("Your Distribution Amount:", `$${individualAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

        // Footer
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor("#999999")
          .text(
            "This notice is generated by DeedSlice. For questions, contact your property sponsor.",
            60,
            680,
            { align: "center", width: 492 }
          );
      }

      doc.end();
    });

    const filename = `distribution_notices_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}_${effectivePeriod.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("Distribution notices error:", err);
    return NextResponse.json({ error: "Failed to generate notices" }, { status: 500 });
  }
}
