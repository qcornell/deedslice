import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import PDFDocument from "pdfkit";

/**
 * POST /api/legal-templates
 *
 * Generate legal document PDFs for a property.
 * Body: { propertyId, templateType: "subscription" | "operating" | "disclosure", investorId? }
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "legal-templates", { max: 30, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const body = await req.json();
    const { propertyId, templateType, investorId } = body;

    if (!propertyId || !templateType) {
      return NextResponse.json({ error: "Missing propertyId or templateType" }, { status: 400 });
    }

    if (!["subscription", "operating", "disclosure"].includes(templateType)) {
      return NextResponse.json({ error: "Invalid templateType. Must be: subscription, operating, or disclosure" }, { status: 400 });
    }

    // Load property + verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    // Load investor if specified
    let investor: any = null;
    if (investorId) {
      const { data: invData } = await supabaseAdmin
        .from("ds_investors")
        .select("*")
        .eq("id", investorId)
        .eq("property_id", propertyId)
        .single();
      investor = invData;
    }

    const pdfBuffer = await generatePDF(templateType, property, investor);

    const typeLabels: Record<string, string> = {
      subscription: "Subscription_Agreement",
      operating: "Operating_Agreement",
      disclosure: "Investor_Disclosure",
    };
    const filename = `DeedSlice_${typeLabels[templateType]}_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("Legal template generation error:", err);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}

// ── PDF Generation ───────────────────────────────────────────

const TEAL = "#0D9488";
const DARK = "#111827";
const GRAY = "#666666";
const LIGHT_GRAY = "#999999";

function generatePDF(templateType: string, property: any, investor: any): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 60 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = 612;
    const margin = 60;
    const innerW = pageW - margin * 2;
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Header
    addHeader(doc, margin, innerW, dateStr, property.name);

    switch (templateType) {
      case "subscription":
        generateSubscription(doc, margin, innerW, property, investor, dateStr);
        break;
      case "operating":
        generateOperating(doc, margin, innerW, property, dateStr);
        break;
      case "disclosure":
        generateDisclosure(doc, margin, innerW, property, dateStr);
        break;
    }

    // Footer
    addFooter(doc, pageW, margin, innerW);

    doc.end();
  });
}

function addHeader(doc: any, margin: number, innerW: number, dateStr: string, propertyName: string) {
  // DeedSlice branding
  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor(TEAL)
    .text("DeedSlice", margin, 40, { width: innerW });

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(LIGHT_GRAY)
    .text(dateStr, margin, 42, { align: "right", width: innerW });

  // Divider
  doc
    .strokeColor(TEAL)
    .lineWidth(1.5)
    .moveTo(margin, 65)
    .lineTo(margin + innerW, 65)
    .stroke();

  doc.moveDown(1);
}

function addFooter(doc: any, pageW: number, margin: number, innerW: number) {
  const footerY = 720;
  doc
    .strokeColor("#E5E7EB")
    .lineWidth(0.5)
    .moveTo(margin, footerY)
    .lineTo(margin + innerW, footerY)
    .stroke();

  doc
    .fontSize(7)
    .font("Helvetica")
    .fillColor(LIGHT_GRAY)
    .text(
      "This document is a template generated by DeedSlice for informational purposes. It does not constitute legal advice. Consult qualified legal counsel before executing any agreements.",
      margin,
      footerY + 10,
      { align: "center", width: innerW }
    );

  doc
    .fontSize(8)
    .font("Helvetica-Bold")
    .fillColor(TEAL)
    .text("Generated by DeedSlice — deedslice.com", margin, footerY + 35, { align: "center", width: innerW });
}

function sectionTitle(doc: any, margin: number, innerW: number, title: string) {
  doc.moveDown(0.8);
  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor(DARK)
    .text(title, margin, undefined, { width: innerW });
  doc.moveDown(0.3);
}

function bodyText(doc: any, margin: number, innerW: number, text: string) {
  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(DARK)
    .text(text, margin, undefined, { width: innerW, lineGap: 3 });
}

function labelValue(doc: any, margin: number, label: string, value: string) {
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor(GRAY)
    .text(`${label}: `, margin, undefined, { continued: true })
    .font("Helvetica")
    .fillColor(DARK)
    .text(value);
}

// ── Subscription Agreement ───────────────────────────────────

function generateSubscription(doc: any, margin: number, innerW: number, property: any, investor: any, dateStr: string) {
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(DARK)
    .text("SUBSCRIPTION AGREEMENT", margin, 85, { align: "center", width: innerW });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(GRAY)
    .text("Regulation D Rule 506(c) Private Placement", margin, undefined, { align: "center", width: innerW });

  doc.moveDown(1);

  // Property Details
  sectionTitle(doc, margin, innerW, "1. Property Details");
  labelValue(doc, margin, "Property Name", property.name);
  if (property.address) labelValue(doc, margin, "Address", property.address);
  labelValue(doc, margin, "Property Type", (property.property_type || "residential").charAt(0).toUpperCase() + (property.property_type || "residential").slice(1));
  labelValue(doc, margin, "Valuation", `$${Number(property.valuation_usd).toLocaleString()}`);
  labelValue(doc, margin, "Total Slices", property.total_slices.toLocaleString());
  labelValue(doc, margin, "Price Per Slice", `$${Math.round(property.valuation_usd / property.total_slices).toLocaleString()}`);

  // Investor Details
  sectionTitle(doc, margin, innerW, "2. Investor Details");
  if (investor) {
    labelValue(doc, margin, "Name", investor.name);
    if (investor.email) labelValue(doc, margin, "Email", investor.email);
    if (investor.wallet_address) labelValue(doc, margin, "Hedera Wallet", investor.wallet_address);
    labelValue(doc, margin, "Slices Subscribed", investor.slices_owned.toLocaleString());
    labelValue(doc, margin, "Ownership Percentage", `${investor.percentage}%`);
  } else {
    bodyText(doc, margin, innerW, "Investor: ___________________________________");
    doc.moveDown(0.3);
    bodyText(doc, margin, innerW, "Email: ___________________________________");
    doc.moveDown(0.3);
    bodyText(doc, margin, innerW, "Hedera Wallet Address: ___________________________________");
    doc.moveDown(0.3);
    bodyText(doc, margin, innerW, "Number of Slices: ___________");
  }

  // Accredited Investor Representations
  sectionTitle(doc, margin, innerW, "3. Accredited Investor Representations");
  bodyText(doc, margin, innerW,
    "The undersigned investor hereby represents and warrants that they qualify as an \"accredited investor\" as defined in Rule 501(a) of Regulation D under the Securities Act of 1933, as amended, by satisfying at least one of the following criteria:"
  );
  doc.moveDown(0.3);
  const criteria = [
    "Individual income exceeding $200,000 (or $300,000 jointly with spouse) in each of the two most recent years, with reasonable expectation of the same in the current year.",
    "Individual net worth (or joint net worth with spouse) exceeding $1,000,000, excluding the value of the primary residence.",
    "A holder in good standing of the Series 7, Series 65, or Series 82 license(s).",
    "A trust with assets exceeding $5,000,000, not formed specifically to acquire the securities offered.",
  ];
  for (const c of criteria) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${c}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }

  // Risk Disclosures
  sectionTitle(doc, margin, innerW, "4. Risk Disclosures");
  bodyText(doc, margin, innerW,
    "The subscriber acknowledges and accepts the following risks associated with this investment:"
  );
  doc.moveDown(0.3);
  const risks = [
    "Real estate investments are illiquid and subject to market fluctuations.",
    "Tokenized securities are subject to blockchain technology risks, including network disruptions.",
    "There is no guarantee of distributions, returns, or capital preservation.",
    "Transfer restrictions may apply under applicable securities laws.",
    "Past performance is not indicative of future results.",
  ];
  for (const r of risks) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${r}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }

  // Signature Block
  sectionTitle(doc, margin, innerW, "5. Signature");
  doc.moveDown(1.5);
  bodyText(doc, margin, innerW, "Investor Signature: _________________________________________");
  doc.moveDown(1);
  bodyText(doc, margin, innerW, `Date: ${dateStr}`);
  doc.moveDown(1);
  bodyText(doc, margin, innerW, "Issuer Signature: _________________________________________");
  doc.moveDown(1);
  bodyText(doc, margin, innerW, `Date: ${dateStr}`);
}

// ── Operating Agreement ──────────────────────────────────────

function generateOperating(doc: any, margin: number, innerW: number, property: any, dateStr: string) {
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(DARK)
    .text("SPV / LLC OPERATING AGREEMENT", margin, 85, { align: "center", width: innerW });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(GRAY)
    .text("Summary of Terms", margin, undefined, { align: "center", width: innerW });

  doc.moveDown(1);

  // Property Description
  sectionTitle(doc, margin, innerW, "1. Property Description");
  labelValue(doc, margin, "Property Name", property.name);
  if (property.address) labelValue(doc, margin, "Address", property.address);
  labelValue(doc, margin, "Property Type", (property.property_type || "residential").charAt(0).toUpperCase() + (property.property_type || "residential").slice(1));
  labelValue(doc, margin, "Valuation", `$${Number(property.valuation_usd).toLocaleString()}`);
  if (property.description) {
    doc.moveDown(0.3);
    bodyText(doc, margin, innerW, property.description);
  }

  // Token Structure
  sectionTitle(doc, margin, innerW, "2. Token Structure");
  bodyText(doc, margin, innerW,
    "This property is tokenized on the Hedera network using a dual-token structure:"
  );
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor(DARK)
    .text(`• NFT Master Deed: ${property.nft_token_id || "Pending deployment"} (serial #${property.nft_serial || "—"})`, margin + 15, undefined, { width: innerW - 15 });
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica").fillColor(DARK)
    .text(`• Share Tokens: ${property.share_token_id || "Pending deployment"} (symbol: ${property.share_token_symbol || "—"})`, margin + 15, undefined, { width: innerW - 15 });
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica").fillColor(DARK)
    .text(`• Total Supply: ${property.total_slices?.toLocaleString()} slices`, margin + 15, undefined, { width: innerW - 15 });
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica").fillColor(DARK)
    .text(`• Network: Hedera ${property.network === "mainnet" ? "Mainnet" : "Testnet"}`, margin + 15, undefined, { width: innerW - 15 });

  if (property.audit_topic_id) {
    doc.moveDown(0.2);
    doc.fontSize(10).font("Helvetica").fillColor(DARK)
      .text(`• Audit Topic: ${property.audit_topic_id} (Hedera Consensus Service)`, margin + 15, undefined, { width: innerW - 15 });
  }

  // Distribution Waterfall
  sectionTitle(doc, margin, innerW, "3. Distribution Waterfall");
  bodyText(doc, margin, innerW,
    "Income generated by the property (rental income, sale proceeds, or other revenue) shall be distributed to token holders as follows:"
  );
  doc.moveDown(0.3);
  const waterfall = [
    "Operating expenses and management fees are deducted first.",
    "Remaining net income is distributed pro-rata based on each investor's share token holdings.",
    "Distributions are recorded on the Hedera audit trail for transparency.",
    "Distribution frequency and amounts are at the discretion of the property manager.",
  ];
  for (const w of waterfall) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${w}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }

  // Transfer Restrictions
  sectionTitle(doc, margin, innerW, "4. Transfer Restrictions");
  bodyText(doc, margin, innerW,
    "Share tokens are subject to the following transfer restrictions in compliance with applicable securities regulations:"
  );
  doc.moveDown(0.3);
  const restrictions = [
    "Tokens may only be transferred to verified, accredited investors (if applicable under the offering exemption).",
    "All transfers must comply with Rule 144 holding periods and applicable resale restrictions.",
    "The SPV manager reserves the right to freeze or claw back tokens in cases of regulatory non-compliance.",
    "KYC/AML verification may be required for all token recipients.",
  ];
  for (const r of restrictions) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${r}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }
}

// ── Investor Disclosure ──────────────────────────────────────

function generateDisclosure(doc: any, margin: number, innerW: number, property: any, dateStr: string) {
  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(DARK)
    .text("INVESTOR DISCLOSURE", margin, 85, { align: "center", width: innerW });

  doc
    .fontSize(10)
    .font("Helvetica")
    .fillColor(GRAY)
    .text("One-Pager Summary", margin, undefined, { align: "center", width: innerW });

  doc.moveDown(1);

  // Property Summary
  sectionTitle(doc, margin, innerW, "Property Summary");
  labelValue(doc, margin, "Property", property.name);
  if (property.address) labelValue(doc, margin, "Location", property.address);
  labelValue(doc, margin, "Type", (property.property_type || "residential").charAt(0).toUpperCase() + (property.property_type || "residential").slice(1));
  labelValue(doc, margin, "Valuation", `$${Number(property.valuation_usd).toLocaleString()}`);
  labelValue(doc, margin, "Total Slices", property.total_slices.toLocaleString());
  labelValue(doc, margin, "Price Per Slice", `$${Math.round(property.valuation_usd / property.total_slices).toLocaleString()}`);
  labelValue(doc, margin, "Network", `Hedera ${property.network === "mainnet" ? "Mainnet" : "Testnet"}`);
  if (property.description) {
    doc.moveDown(0.3);
    bodyText(doc, margin, innerW, property.description);
  }

  // How Tokenization Works
  sectionTitle(doc, margin, innerW, "How Tokenization Works");
  bodyText(doc, margin, innerW,
    "DeedSlice tokenizes real estate by creating digital representations of property ownership on the Hedera blockchain:"
  );
  doc.moveDown(0.3);
  const steps = [
    "An NFT Master Deed is minted as the on-chain record of the property.",
    "Fungible share tokens are created, each representing a fractional ownership slice.",
    "Share tokens are distributed to verified investors via their Hedera wallets.",
    "All transactions are logged to an immutable audit trail using Hedera Consensus Service.",
    "Investors can verify ownership and transaction history at any time via HashScan.",
  ];
  for (const s of steps) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${s}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }

  // Risk Factors
  sectionTitle(doc, margin, innerW, "Risk Factors");
  bodyText(doc, margin, innerW,
    "Investing in tokenized real estate involves risks. Please consider the following:"
  );
  doc.moveDown(0.3);
  const risks = [
    "Illiquidity: There may be no secondary market for these tokens. You may not be able to sell your investment quickly.",
    "Market Risk: Property values can decline due to market conditions, local economic factors, or natural events.",
    "Technology Risk: Blockchain networks may experience outages, bugs, or security vulnerabilities.",
    "Regulatory Risk: Securities regulations may change, affecting the legality or transferability of tokens.",
    "No Guarantee of Returns: Past performance is not indicative of future results. Distributions are not guaranteed.",
    "Capital at Risk: You may lose some or all of your invested capital.",
  ];
  for (const r of risks) {
    doc.fontSize(10).font("Helvetica").fillColor(DARK).text(`• ${r}`, margin + 15, undefined, { width: innerW - 15, lineGap: 2 });
    doc.moveDown(0.2);
  }

  // Contact Information
  sectionTitle(doc, margin, innerW, "Contact Information");
  bodyText(doc, margin, innerW,
    "For questions about this property or your investment, please contact the property issuer through the DeedSlice platform. All communication and documentation is available through your investor portal."
  );
  doc.moveDown(0.3);
  if (property.share_token_id) {
    const network = property.network === "mainnet" ? "mainnet" : "testnet";
    labelValue(doc, margin, "Verify on HashScan", `hashscan.io/${network}/token/${property.share_token_id}`);
  }
}
