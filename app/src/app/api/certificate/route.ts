import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import PDFDocument from "pdfkit";

export async function GET(req: NextRequest) {
  try {
    // Rate limit
    const rateLimitRes = applyRateLimit(req.headers, "certificate", { max: 60, windowSec: 3600 });
    if (rateLimitRes) return rateLimitRes;

    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Get propertyId from query params
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // Verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    if (property.status !== "live") {
      return NextResponse.json({ error: "Certificate only available for live properties" }, { status: 400 });
    }

    // Generate PDF
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: "LETTER", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW = 612; // LETTER width in points
      const pageH = 792; // LETTER height in points
      const margin = 40;
      const innerW = pageW - margin * 2;

      // Colors
      const teal = "#0D9488";
      const darkText = "#111827";
      const valueText = "#333333";
      const labelGray = "#666666";
      const lightGray = "#999999";
      const borderColor = "#0D9488";

      // ── Decorative border ──────────────────────────────────
      const bm = 30; // border margin from page edge
      doc
        .strokeColor(borderColor)
        .lineWidth(2)
        .rect(bm, bm, pageW - bm * 2, pageH - bm * 2)
        .stroke();
      // Inner thin border
      doc
        .strokeColor(borderColor)
        .lineWidth(0.5)
        .rect(bm + 6, bm + 6, pageW - (bm + 6) * 2, pageH - (bm + 6) * 2)
        .stroke();

      // ── Header ─────────────────────────────────────────────
      doc.moveDown(2.5);
      doc
        .fontSize(26)
        .font("Helvetica-Bold")
        .fillColor(teal)
        .text("Certificate of Tokenization", margin, 80, {
          align: "center",
          width: innerW,
        });

      // Decorative line under header
      const lineY = 115;
      const lineInset = 160;
      doc
        .strokeColor(teal)
        .lineWidth(1.5)
        .moveTo(lineInset, lineY)
        .lineTo(pageW - lineInset, lineY)
        .stroke();
      // Small diamond accent in center
      const cx = pageW / 2;
      doc
        .fillColor(teal)
        .save()
        .translate(cx, lineY)
        .rotate(45)
        .rect(-4, -4, 8, 8)
        .fill()
        .restore();

      // ── Property Info Block ────────────────────────────────
      let y = 140;

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor(darkText)
        .text(property.name, margin, y, { align: "center", width: innerW });
      y = (doc as any).y + 4;

      if (property.address) {
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor(labelGray)
          .text(property.address, margin, y, { align: "center", width: innerW });
        y = (doc as any).y + 2;
      }

      const propertyTypeLabel = property.property_type
        ? property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)
        : "Property";
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(labelGray)
        .text(propertyTypeLabel + " Property", margin, y, { align: "center", width: innerW });

      y = (doc as any).y + 16;

      // ── Divider ────────────────────────────────────────────
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .moveTo(margin + 40, y)
        .lineTo(pageW - margin - 40, y)
        .stroke();

      y += 20;

      // ── Blockchain Details Table ───────────────────────────
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(teal)
        .text("Blockchain Details", margin, y, { align: "center", width: innerW });
      y += 24;

      const tableLeft = margin + 50;
      const tableValX = margin + 220;
      const tableValW = innerW - 220;
      const rowH = 22;

      const network = property.network === "mainnet" ? "mainnet" : "testnet";
      const networkLabel = property.network === "mainnet" ? "Mainnet" : "Testnet";

      function addTableRow(label: string, value: string, isMonospace = false) {
        doc
          .fontSize(9.5)
          .font("Helvetica")
          .fillColor(labelGray)
          .text(label, tableLeft, y, { width: 170 });
        doc
          .fontSize(9.5)
          .font(isMonospace ? "Courier" : "Helvetica-Bold")
          .fillColor(valueText)
          .text(value, tableValX, y, { width: tableValW });
        y += rowH;
      }

      function addTableRowWithUrl(label: string, value: string, url: string) {
        doc
          .fontSize(9.5)
          .font("Helvetica")
          .fillColor(labelGray)
          .text(label, tableLeft, y, { width: 170 });
        doc
          .fontSize(9.5)
          .font("Courier")
          .fillColor(valueText)
          .text(value, tableValX, y, { width: tableValW });
        y += 14;
        doc
          .fontSize(7.5)
          .font("Helvetica")
          .fillColor(teal)
          .text(url, tableValX, y, { width: tableValW });
        y += rowH - 4;
      }

      // Alternating row backgrounds
      const rows = [
        { label: "NFT Deed Token ID", value: property.nft_token_id, url: property.nft_token_id ? `hashscan.io/${network}/token/${property.nft_token_id}` : null },
        { label: "Share Token ID", value: property.share_token_id, url: property.share_token_id ? `hashscan.io/${network}/token/${property.share_token_id}` : null },
        { label: "Token Symbol", value: property.share_token_symbol },
        { label: "Total Slices", value: property.total_slices?.toLocaleString() },
        { label: "Valuation", value: `$${property.valuation_usd?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { label: "Audit Topic ID", value: property.audit_topic_id, url: property.audit_topic_id ? `hashscan.io/${network}/topic/${property.audit_topic_id}` : null },
        { label: "Network", value: networkLabel },
        { label: "Deployed", value: property.deployed_at ? new Date(property.deployed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A" },
      ];

      for (const row of rows) {
        if (row.url && row.value) {
          addTableRowWithUrl(row.label, row.value, row.url);
        } else {
          const isMonoRow = ["NFT Deed Token ID", "Share Token ID", "Token Symbol", "Audit Topic ID"].includes(row.label);
          addTableRow(row.label, row.value || "N/A", isMonoRow);
        }
      }

      // ── Divider ────────────────────────────────────────────
      y += 10;
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(0.5)
        .moveTo(margin + 40, y)
        .lineTo(pageW - margin - 40, y)
        .stroke();
      y += 20;

      // ── Verification Section ───────────────────────────────
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor(teal)
        .text("Verification", margin, y, { align: "center", width: innerW });
      y += 22;

      doc
        .fontSize(9.5)
        .font("Helvetica")
        .fillColor(valueText)
        .text(
          "This property has been tokenized on the Hedera network. All ownership records are immutable and publicly verifiable.",
          margin + 50,
          y,
          { align: "center", width: innerW - 100 }
        );
      y = (doc as any).y + 12;

      if (property.share_token_id) {
        const verifyUrl = `hashscan.io/${network}/token/${property.share_token_id}`;
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor(labelGray)
          .text("Verify on HashScan:", margin + 50, y, { align: "center", width: innerW - 100, continued: true })
          .font("Courier")
          .fillColor(teal)
          .text(` ${verifyUrl}`, { align: "center" });
      }

      // ── Footer ─────────────────────────────────────────────
      const footerY = pageH - 100;

      // Generation date
      const genDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(lightGray)
        .text(`Generated: ${genDate}`, margin, footerY, { align: "center", width: innerW });

      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(teal)
        .text("Generated by DeedSlice — deedslice.com", margin, footerY + 14, { align: "center", width: innerW });

      doc
        .fontSize(7)
        .font("Helvetica")
        .fillColor(lightGray)
        .text(
          "This certificate is for informational purposes and does not constitute a security, investment advice, or legal document.",
          margin + 40,
          footerY + 32,
          { align: "center", width: innerW - 80 }
        );

      doc.end();
    });

    const filename = `DeedSlice_Certificate_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("Certificate generation error:", err);
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 });
  }
}
