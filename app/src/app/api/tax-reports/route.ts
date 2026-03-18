import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import PDFDocument from "pdfkit";

/**
 * POST /api/tax-reports
 *
 * Generate tax reports (PDF or CSV) for distributions in a given year.
 * Body: { year, propertyId?, format: "pdf" | "csv" }
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "tax-reports", { max: 20, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { year, propertyId, format } = body;

    if (!year || !format) {
      return NextResponse.json({ error: "Missing year or format" }, { status: 400 });
    }

    if (!["pdf", "csv"].includes(format)) {
      return NextResponse.json({ error: "Invalid format. Must be: pdf or csv" }, { status: 400 });
    }

    // Load all properties owned by user
    let query = supabaseAdmin
      .from("ds_properties")
      .select("id, name")
      .eq("owner_id", user.id);

    if (propertyId) {
      query = query.eq("id", propertyId);
    }

    const { data: properties } = await query;
    if (!properties || properties.length === 0) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 });
    }

    const propertyIds = properties.map((p: any) => p.id);
    const propertyMap = new Map(properties.map((p: any) => [p.id, p.name]));

    // Load distributions for the year
    const startDate = `${year}-01-01T00:00:00.000Z`;
    const endDate = `${Number(year) + 1}-01-01T00:00:00.000Z`;

    const { data: distributions } = await supabaseAdmin
      .from("ds_distributions")
      .select("*")
      .in("property_id", propertyIds)
      .gte("paid_at", startDate)
      .lt("paid_at", endDate)
      .eq("status", "paid");

    // Load investors for name/email lookup
    const { data: allInvestors } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email")
      .in("property_id", propertyIds);

    const investorMap = new Map((allInvestors || []).map((i: any) => [i.id, i]));

    // Group by investor+property, sum amounts
    interface ReportRow {
      investorName: string;
      investorEmail: string;
      property: string;
      totalDistributed: number;
    }

    const groupMap = new Map<string, ReportRow>();

    for (const d of (distributions || [])) {
      const key = `${d.investor_id}_${d.property_id}`;
      const inv = investorMap.get(d.investor_id);
      const existing = groupMap.get(key) || {
        investorName: inv?.name || "Unknown",
        investorEmail: inv?.email || "",
        property: propertyMap.get(d.property_id) || "Unknown",
        totalDistributed: 0,
      };
      existing.totalDistributed += Number(d.amount_usd);
      groupMap.set(key, existing);
    }

    const rows = Array.from(groupMap.values()).sort((a, b) => a.investorName.localeCompare(b.investorName));

    if (format === "csv") {
      return generateCSV(rows, year);
    } else {
      return generateTaxPDF(rows, year, propertyId ? (propertyMap.get(propertyId) || "Property") : "All Properties");
    }
  } catch (err) {
    console.error("Tax report generation error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// ── CSV Generation ───────────────────────────────────────────

function generateCSV(rows: Array<{ investorName: string; investorEmail: string; property: string; totalDistributed: number }>, year: number): Response {
  const header = "investor_name,investor_email,property,total_distributed,year";
  const lines = rows.map(r =>
    `"${r.investorName.replace(/"/g, '""')}","${r.investorEmail.replace(/"/g, '""')}","${r.property.replace(/"/g, '""')}",${r.totalDistributed.toFixed(2)},${year}`
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="DeedSlice_Tax_Report_${year}.csv"`,
    },
  });
}

// ── PDF Generation ───────────────────────────────────────────

function generateTaxPDF(
  rows: Array<{ investorName: string; investorEmail: string; property: string; totalDistributed: number }>,
  year: number,
  propertyLabel: string,
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(
        new Response(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="DeedSlice_Tax_Report_${year}.pdf"`,
            "Content-Length": String(pdfBuffer.length),
          },
        })
      );
    });
    doc.on("error", reject);

    const pageW = 612;
    const margin = 50;
    const innerW = pageW - margin * 2;
    const TEAL = "#0D9488";
    const DARK = "#111827";
    const GRAY = "#666666";
    const LIGHT_GRAY = "#999999";

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Header
    doc.fontSize(18).font("Helvetica-Bold").fillColor(TEAL).text("DeedSlice", margin, 40, { width: innerW });
    doc.fontSize(9).font("Helvetica").fillColor(LIGHT_GRAY).text(dateStr, margin, 42, { align: "right", width: innerW });
    doc.strokeColor(TEAL).lineWidth(1.5).moveTo(margin, 65).lineTo(margin + innerW, 65).stroke();

    // Title
    doc.fontSize(16).font("Helvetica-Bold").fillColor(DARK).text(`Tax Distribution Report — ${year}`, margin, 85, { align: "center", width: innerW });
    doc.fontSize(10).font("Helvetica").fillColor(GRAY).text(propertyLabel, margin, undefined, { align: "center", width: innerW });

    doc.moveDown(1.5);

    // Summary
    const grandTotal = rows.reduce((s, r) => s + r.totalDistributed, 0);
    doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK)
      .text(`Total Distributed: $${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, margin, undefined, { width: innerW });
    doc.fontSize(10).font("Helvetica").fillColor(GRAY)
      .text(`${rows.length} investor${rows.length !== 1 ? "s" : ""} · ${year} calendar year`, margin, undefined, { width: innerW });

    doc.moveDown(1);

    if (rows.length === 0) {
      doc.fontSize(11).font("Helvetica").fillColor(GRAY)
        .text("No paid distributions found for this period.", margin, undefined, { align: "center", width: innerW });
    } else {
      // Table header
      const colX = {
        name: margin,
        email: margin + 140,
        property: margin + 280,
        total: margin + 420,
      };

      let y = (doc as any).y;

      // Header row background
      doc.rect(margin, y - 2, innerW, 18).fill("#F0FDFA");
      doc.fontSize(9).font("Helvetica-Bold").fillColor(TEAL);
      doc.text("Investor", colX.name, y, { width: 135 });
      doc.text("Email", colX.email, y, { width: 135 });
      doc.text("Property", colX.property, y, { width: 135 });
      doc.text("Total", colX.total, y, { width: 90, align: "right" });

      y += 22;

      // Separator
      doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(margin, y - 4).lineTo(margin + innerW, y - 4).stroke();

      for (const row of rows) {
        // Check for page break
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.fontSize(9).font("Helvetica").fillColor(DARK);
        doc.text(row.investorName, colX.name, y, { width: 135, ellipsis: true });
        doc.fontSize(9).font("Helvetica").fillColor(GRAY);
        doc.text(row.investorEmail || "—", colX.email, y, { width: 135, ellipsis: true });
        doc.text(row.property, colX.property, y, { width: 135, ellipsis: true });
        doc.fontSize(9).font("Helvetica-Bold").fillColor(DARK);
        doc.text(`$${row.totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX.total, y, { width: 90, align: "right" });

        y += 18;
      }

      // Grand total row
      y += 6;
      doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(margin, y - 4).lineTo(margin + innerW, y - 4).stroke();
      doc.fontSize(10).font("Helvetica-Bold").fillColor(DARK);
      doc.text("Grand Total", colX.name, y, { width: 200 });
      doc.text(`$${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX.total, y, { width: 90, align: "right" });
    }

    // Footer
    const footerY = 720;
    doc.strokeColor("#E5E7EB").lineWidth(0.5).moveTo(margin, footerY).lineTo(margin + innerW, footerY).stroke();
    doc.fontSize(7).font("Helvetica").fillColor(LIGHT_GRAY)
      .text(
        "This report is for informational purposes only. Consult a tax professional for filing requirements.",
        margin,
        footerY + 10,
        { align: "center", width: innerW }
      );
    doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL)
      .text("Generated by DeedSlice — deedslice.com", margin, footerY + 30, { align: "center", width: innerW });

    doc.end();
  });
}
