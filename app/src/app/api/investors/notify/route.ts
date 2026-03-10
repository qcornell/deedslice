import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimitAsync } from "@/lib/rate-limit";
import { sendDistributionEmail } from "@/lib/email";
import { Resend } from "resend";
import type { Property, Investor, Distribution, Organization, OrgBranding } from "@/types/database";

// ── Helpers ─────────────────────────────────────────────────

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

const FROM = () => process.env.EMAIL_FROM || "DeedSlice <noreply@deedslice.com>";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";

// Branded email layout — uses org branding when available
function brandedLayout(
  title: string,
  body: string,
  branding?: { primary_color: string; logo_url: string | null; email_sender_name: string | null; footer_text: string | null; show_powered_by: boolean } | null,
) {
  const primary = branding?.primary_color || "#0D9488";
  const bg = "#F8FAFB";
  const card = "#FFFFFF";
  const muted = "#94A3B8";
  const text = "#0F172A";

  const logoHtml = branding?.logo_url
    ? `<img src="${branding.logo_url}" alt="" style="max-height:32px;max-width:160px;" />`
    : `<span style="font-size:20px;font-weight:700;color:${text};letter-spacing:-0.5px;">🏠 DeedSlice</span>`;

  const footerText = branding?.footer_text || "DeedSlice — Real estate tokenization on Hedera";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">${logoHtml}</div>
    <div style="background:${card};border-radius:16px;padding:36px 32px;border:1px solid #E2E8F0;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${text};letter-spacing:-0.3px;">${title}</h1>
      ${body}
    </div>
    <div style="text-align:center;margin-top:32px;color:${muted};font-size:11px;line-height:1.6;">
      <p style="margin:0;">${footerText}</p>
      ${branding?.show_powered_by !== false ? `<p style="margin:4px 0 0;"><a href="https://deedslice.com" style="color:${primary};text-decoration:none;">Powered by DeedSlice</a></p>` : ""}
    </div>
  </div>
</body>
</html>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#0F172A;">${text}</p>`;
}

function button(text: string, href: string, color?: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <a href="${href}" style="display:inline-block;background:${color || "#0D9488"};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
      ${text}
    </a>
  </div>`;
}

// ── Route Handler ───────────────────────────────────────────

/**
 * POST /api/investors/notify
 *
 * Send bulk notifications to all investors for a property.
 * Body: { propertyId, type: "distribution"|"document"|"update", subject?, message?, period? }
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10/hour for bulk email sends
  const blocked = await applyRateLimitAsync(
    req.headers,
    "investor-notify",
    { max: 10, windowSec: 3600 },
  );
  if (blocked) return blocked;

  try {
    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Parse body
    const body = await req.json();
    const { propertyId, type, subject, message, period } = body as {
      propertyId?: string;
      type?: string;
      subject?: string;
      message?: string;
      period?: string;
    };

    if (!propertyId || !type) {
      return NextResponse.json({ error: "Missing propertyId or type" }, { status: 400 });
    }

    if (!["distribution", "document", "update"].includes(type)) {
      return NextResponse.json({ error: "Invalid type. Must be: distribution, document, or update" }, { status: 400 });
    }

    if (type === "update" && (!subject || !message)) {
      return NextResponse.json({ error: "Custom updates require subject and message" }, { status: 400 });
    }

    // Verify property belongs to user
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    const property = propData as Property | null;
    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Get all investors with emails
    const { data: investorsData } = await supabaseAdmin
      .from("ds_investors")
      .select("*")
      .eq("property_id", propertyId);

    const investors = (investorsData || []) as Investor[];
    const investorsWithEmail = investors.filter((i) => i.email);

    if (investorsWithEmail.length === 0) {
      return NextResponse.json({ error: "No investors with email addresses found" }, { status: 400 });
    }

    // Get org branding (if property belongs to an org)
    let branding: OrgBranding | null = null;
    let org: Organization | null = null;

    if (property.org_id) {
      const [orgRes, brandingRes] = await Promise.all([
        supabaseAdmin.from("ds_organizations").select("*").eq("id", property.org_id).single(),
        supabaseAdmin.from("ds_org_branding").select("*").eq("org_id", property.org_id).single(),
      ]);
      org = orgRes.data as Organization | null;
      branding = brandingRes.data as OrgBranding | null;
    }

    const primaryColor = branding?.primary_color || "#0D9488";
    const portalBase = APP_URL();

    // Build email promises based on type
    const emailPromises: Promise<{ investor: string; success: boolean; error?: string }>[] = [];

    if (type === "distribution") {
      // Get distributions for the specified period (or latest)
      let distributionQuery = supabaseAdmin
        .from("ds_distributions")
        .select("*")
        .eq("property_id", propertyId);

      if (period) {
        distributionQuery = distributionQuery.eq("period", period);
      }

      const { data: distData } = await distributionQuery;
      const distributions = (distData || []) as Distribution[];

      // Group by investor — take the most recent distribution per investor
      const distByInvestor = new Map<string, Distribution>();
      for (const d of distributions) {
        const existing = distByInvestor.get(d.investor_id);
        if (!existing || new Date(d.created_at) > new Date(existing.created_at)) {
          distByInvestor.set(d.investor_id, d);
        }
      }

      for (const investor of investorsWithEmail) {
        const dist = distByInvestor.get(investor.id);
        if (!dist) continue; // No distribution for this investor — skip

        const portalUrl = `${portalBase}/view/${propertyId}`;

        emailPromises.push(
          sendDistributionEmail(
            investor.email!,
            investor.name,
            property.name,
            dist.amount_usd,
            dist.period,
            dist.type,
            portalUrl,
          )
            .then(() => ({ investor: investor.name, success: true }))
            .catch((err) => ({ investor: investor.name, success: false, error: err.message })),
        );
      }

      if (emailPromises.length === 0) {
        return NextResponse.json({
          error: `No distributions found${period ? ` for period "${period}"` : ""}. Record distributions first, then notify.`,
        }, { status: 400 });
      }
    } else if (type === "document") {
      const resend = getResend();
      const senderName = branding?.email_sender_name || "DeedSlice";
      const from = branding?.email_sender_name
        ? `${branding.email_sender_name} <noreply@deedslice.com>`
        : FROM();

      for (const investor of investorsWithEmail) {
        const portalUrl = `${portalBase}/view/${propertyId}`;
        const html = brandedLayout("New Documents Available 📄", `
          ${p(`Hi ${investor.name},`)}
          ${p(`New documents have been uploaded to <strong>${property.name}</strong>.`)}
          ${p("Log in to your investor portal to view and download the latest documents.")}
          ${button("View Documents →", portalUrl, primaryColor)}
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94A3B8;">
            If you have questions about these documents, please contact your property manager.
          </p>
        `, branding);

        emailPromises.push(
          resend.emails
            .send({
              from,
              to: investor.email!,
              subject: `📄 New documents — ${property.name}`,
              html,
            })
            .then(() => ({ investor: investor.name, success: true }))
            .catch((err: any) => ({ investor: investor.name, success: false, error: err.message })),
        );
      }
    } else if (type === "update") {
      const resend = getResend();
      const from = branding?.email_sender_name
        ? `${branding.email_sender_name} <noreply@deedslice.com>`
        : FROM();

      // Convert newlines in message to <br> for HTML
      const htmlMessage = (message || "").replace(/\n/g, "<br>");

      for (const investor of investorsWithEmail) {
        const portalUrl = `${portalBase}/view/${propertyId}`;
        const html = brandedLayout(subject || "Property Update", `
          ${p(`Hi ${investor.name},`)}
          <div style="margin:0 0 14px;font-size:14px;line-height:1.7;color:#0F172A;">${htmlMessage}</div>
          ${button("View Property →", portalUrl, primaryColor)}
        `, branding);

        emailPromises.push(
          resend.emails
            .send({
              from,
              to: investor.email!,
              subject: `${subject} — ${property.name}`,
              html,
            })
            .then(() => ({ investor: investor.name, success: true }))
            .catch((err: any) => ({ investor: investor.name, success: false, error: err.message })),
        );
      }
    }

    // Send all emails in parallel
    const results = await Promise.allSettled(emailPromises);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.success) {
          sent++;
        } else {
          failed++;
          if (r.value.error) errors.push(`${r.value.investor}: ${r.value.error}`);
        }
      } else {
        failed++;
        errors.push(r.reason?.message || "Unknown error");
      }
    }

    // Log audit entry
    const auditDetails = [
      `Bulk ${type} notification: ${sent} sent, ${failed} failed`,
      period ? `Period: ${period}` : null,
      type === "update" ? `Subject: ${subject}` : null,
    ].filter(Boolean).join(". ");

    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: "INVESTOR_NOTIFICATION",
      details: auditDetails,
    } as any);

    return NextResponse.json({
      sent,
      failed,
      total: investorsWithEmail.length,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err: any) {
    console.error("Notify investors error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
