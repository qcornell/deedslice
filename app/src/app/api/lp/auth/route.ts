import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createLpToken, verifyMagicLink, verifyPassword, generateMagicLink } from "@/lib/lp-auth";
import { getTenantBySlug } from "@/lib/tenant";
import { applyRateLimit } from "@/lib/rate-limit";
import type { LpAccount } from "@/types/database";

/**
 * POST /api/lp/auth — LP authentication
 *
 * Modes:
 *   { action: "magic-link", orgSlug, email } → sends magic link email
 *   { action: "verify-magic-link", orgSlug, token } → verifies & returns session
 *   { action: "login", orgSlug, email, password } → password login
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "lp-auth", { max: 20, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const body = await req.json();
    const { action, orgSlug } = body;

    if (!action || !orgSlug) {
      return NextResponse.json({ error: "Missing action or orgSlug" }, { status: 400 });
    }

    const tenant = await getTenantBySlug(orgSlug);
    if (!tenant) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const orgId = tenant.org.id;

    // ── Magic Link Request ──
    if (action === "magic-link") {
      const { email } = body;
      if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

      const token = await generateMagicLink(orgId, email.toLowerCase());

      if (!token) {
        // Don't reveal whether the email exists
        return NextResponse.json({ ok: true, message: "If an account exists, a login link has been sent." });
      }

      // Build magic link URL
      const baseUrl = tenant.org.custom_domain && tenant.org.domain_verified
        ? `https://${tenant.org.custom_domain}`
        : `https://console.deedslice.com/portal/${orgSlug}`;

      const magicUrl = `${baseUrl}/auth/verify?token=${token}`;

      // Send email (using Resend)
      const senderName = tenant.branding.email_sender_name || tenant.org.name;
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: `${senderName} <noreply@deedslice.com>`,
          to: email.toLowerCase(),
          subject: `Sign in to ${tenant.branding.portal_title || tenant.org.name}`,
          html: `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
              ${tenant.branding.logo_url ? `<img src="${tenant.branding.logo_url}" alt="${tenant.org.name}" style="height:40px;margin-bottom:24px;">` : `<h2 style="color:${tenant.branding.primary_color};margin-bottom:24px;">${tenant.org.name}</h2>`}
              <p style="font-size:14px;line-height:1.7;color:#333;">Click below to sign in to your investor portal:</p>
              <a href="${magicUrl}" style="display:inline-block;background:${tenant.branding.primary_color};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">Sign In →</a>
              <p style="font-size:12px;color:#999;margin-top:24px;">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
              ${tenant.branding.show_powered_by ? `<p style="font-size:10px;color:#ccc;margin-top:32px;">Powered by DeedSlice</p>` : ""}
            </div>
          `,
        });
      } catch (err) {
        console.error("Magic link email failed:", err);
      }

      return NextResponse.json({ ok: true, message: "If an account exists, a login link has been sent." });
    }

    // ── Verify Magic Link ──
    if (action === "verify-magic-link") {
      const { token } = body;
      if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

      const lp = await verifyMagicLink(orgId, token);
      if (!lp) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
      }

      const sessionToken = createLpToken(lp);
      return NextResponse.json({ ok: true, token: sessionToken, name: lp.name, email: lp.email });
    }

    // ── Password Login ──
    if (action === "login") {
      const { email, password } = body;
      if (!email || !password) return NextResponse.json({ error: "Missing email or password" }, { status: 400 });

      const { data: lpData } = await supabaseAdmin
        .from("ds_lp_accounts")
        .select("*")
        .eq("org_id", orgId)
        .eq("email", email.toLowerCase())
        .single();

      const lp = lpData as LpAccount | null;

      if (!lp || !lp.password_hash) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      if (!verifyPassword(password, lp.password_hash)) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      // Update last login
      await supabaseAdmin
        .from("ds_lp_accounts")
        .update({ last_login_at: new Date().toISOString() } as any)
        .eq("id", lp.id);

      const sessionToken = createLpToken(lp);
      return NextResponse.json({ ok: true, token: sessionToken, name: lp.name, email: lp.email });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
