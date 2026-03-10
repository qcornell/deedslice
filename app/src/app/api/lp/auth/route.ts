import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createLpToken, verifyMagicLink, verifyPassword, hashPassword, generateMagicLink } from "@/lib/lp-auth";
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
 *   { action: "register", orgSlug, name, email, password? } → self-register (if allowed)
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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";
      const baseUrl = tenant.org.custom_domain && tenant.org.domain_verified
        ? `https://${tenant.org.custom_domain}`
        : `${appUrl}/portal/${orgSlug}`;

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

    // ── Self-Registration ──
    if (action === "register") {
      const { name, email, password } = body;
      if (!name || !email) {
        return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
      }

      // Check if self-registration is allowed
      if (!tenant.settings.allow_investor_self_register) {
        return NextResponse.json({ error: "Registration is invite-only" }, { status: 403 });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if account already exists
      const { data: existing } = await supabaseAdmin
        .from("ds_lp_accounts")
        .select("id")
        .eq("org_id", orgId)
        .eq("email", normalizedEmail)
        .single();

      if (existing) {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }

      // Create the LP account
      const insertData: any = {
        org_id: orgId,
        email: normalizedEmail,
        name: name.trim(),
      };

      if (password) {
        insertData.password_hash = hashPassword(password);
      }

      const { data: newAccount, error: insertError } = await supabaseAdmin
        .from("ds_lp_accounts")
        .insert(insertData)
        .select("*")
        .single();

      if (insertError || !newAccount) {
        console.error("LP registration insert failed:", insertError);
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
      }

      const lp = newAccount as LpAccount;

      // If password was set, auto-login (return session token)
      if (password) {
        await supabaseAdmin
          .from("ds_lp_accounts")
          .update({ last_login_at: new Date().toISOString() } as any)
          .eq("id", lp.id);

        const sessionToken = createLpToken(lp);

        // Also send a welcome email (non-blocking)
        sendWelcomeEmail(tenant, normalizedEmail).catch(err =>
          console.error("Welcome email failed:", err)
        );

        return NextResponse.json({ ok: true, token: sessionToken, name: lp.name, email: lp.email });
      }

      // No password — send magic link for first login
      const magicToken = await generateMagicLink(orgId, normalizedEmail);
      if (magicToken) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";
        const baseUrl = tenant.org.custom_domain && tenant.org.domain_verified
          ? `https://${tenant.org.custom_domain}`
          : `${appUrl}/portal/${orgSlug}`;

        const magicUrl = `${baseUrl}/auth/verify?token=${magicToken}`;
        const senderName = tenant.branding.email_sender_name || tenant.org.name;

        try {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: `${senderName} <noreply@deedslice.com>`,
            to: normalizedEmail,
            subject: `Welcome to ${tenant.branding.portal_title || tenant.org.name}`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                ${tenant.branding.logo_url ? `<img src="${tenant.branding.logo_url}" alt="${tenant.org.name}" style="height:40px;margin-bottom:24px;">` : `<h2 style="color:${tenant.branding.primary_color};margin-bottom:24px;">${tenant.org.name}</h2>`}
                <p style="font-size:14px;line-height:1.7;color:#333;">Welcome, ${name.trim()}. Your investor account has been created.</p>
                <p style="font-size:14px;line-height:1.7;color:#333;">Click below to verify your email and access your portal:</p>
                <a href="${magicUrl}" style="display:inline-block;background:${tenant.branding.primary_color};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">Verify &amp; Sign In &rarr;</a>
                <p style="font-size:12px;color:#999;margin-top:24px;">This link expires in 15 minutes.</p>
                ${tenant.branding.show_powered_by ? `<p style="font-size:10px;color:#ccc;margin-top:32px;">Powered by DeedSlice</p>` : ""}
              </div>
            `,
          });
        } catch (err) {
          console.error("Registration welcome email failed:", err);
        }
      }

      return NextResponse.json({ ok: true, message: "Account created. Check your email to sign in." });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Send a simple welcome email (for password-based registrations).
 */
async function sendWelcomeEmail(tenant: Awaited<ReturnType<typeof getTenantBySlug>>, email: string) {
  if (!tenant) return;
  const senderName = tenant.branding.email_sender_name || tenant.org.name;
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: `${senderName} <noreply@deedslice.com>`,
    to: email,
    subject: `Welcome to ${tenant.branding.portal_title || tenant.org.name}`,
    html: `
      <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
        ${tenant.branding.logo_url ? `<img src="${tenant.branding.logo_url}" alt="${tenant.org.name}" style="height:40px;margin-bottom:24px;">` : `<h2 style="color:${tenant.branding.primary_color};margin-bottom:24px;">${tenant.org.name}</h2>`}
        <p style="font-size:14px;line-height:1.7;color:#333;">Welcome to the investor portal. Your account has been created and is ready to use.</p>
        <p style="font-size:12px;color:#999;margin-top:24px;">You can sign in anytime using your email and password.</p>
        ${tenant.branding.show_powered_by ? `<p style="font-size:10px;color:#ccc;margin-top:32px;">Powered by DeedSlice</p>` : ""}
      </div>
    `,
  });
}
