import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { hashPassword, createLpToken, generateMagicLink } from "@/lib/lp-auth";
import { getTenantBySlug } from "@/lib/tenant";
import { applyRateLimitAsync } from "@/lib/rate-limit";
import { sanitizeEmail, sanitizeText } from "@/lib/sanitize";

/**
 * GET /api/lp/accounts — List LP accounts for the operator's org
 * POST /api/lp/accounts — Create an LP account (+ optionally send invite)
 * PATCH /api/lp/accounts — Update an LP account (reset password, disable, link investor)
 * DELETE /api/lp/accounts — Delete an LP account
 */

async function getOrgForUser(userId: string) {
  const { data: org } = await supabaseAdmin
    .from("ds_organizations")
    .select("*")
    .eq("owner_id", userId)
    .single();
  return org as any;
}

// ─── LIST ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const org = await getOrgForUser(user.id);
    if (!org) return NextResponse.json({ error: "No organization found. Create one in White-Label settings." }, { status: 404 });

    const { data: accounts } = await supabaseAdmin
      .from("ds_lp_accounts")
      .select("id, org_id, investor_id, email, name, last_login_at, created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });

    // Enrich with investor details if linked
    const enriched = await Promise.all(
      (accounts || []).map(async (acc: any) => {
        let investor = null;
        if (acc.investor_id) {
          const { data: inv } = await supabaseAdmin
            .from("ds_investors")
            .select("id, name, email, slices_owned, percentage, property_id")
            .eq("id", acc.investor_id)
            .single();
          if (inv) {
            const { data: prop } = await supabaseAdmin
              .from("ds_properties")
              .select("name")
              .eq("id", (inv as any).property_id)
              .single();
            investor = { ...inv, propertyName: (prop as any)?.name || "" };
          }
        }
        return { ...acc, investor };
      })
    );

    return NextResponse.json({ accounts: enriched });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── CREATE ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const blocked = await applyRateLimitAsync(req.headers, "lp-accounts-create", { max: 20, windowSec: 300 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const org = await getOrgForUser(user.id);
    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await req.json();
    const email = body.email ? sanitizeEmail(body.email) : null;
    const name = body.name ? sanitizeText(body.name, 200) : null;
    const password = body.password || null;
    const investorId = body.investorId || null;
    const sendInvite = body.sendInvite !== false; // default true

    if (!email) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

    // Check duplicate
    const { data: existing } = await supabaseAdmin
      .from("ds_lp_accounts")
      .select("id")
      .eq("org_id", org.id)
      .eq("email", email)
      .single();

    if (existing) return NextResponse.json({ error: "An LP account with this email already exists" }, { status: 409 });

    // If investorId, verify it belongs to the operator's property
    if (investorId) {
      const { data: inv } = await supabaseAdmin
        .from("ds_investors")
        .select("id, property_id")
        .eq("id", investorId)
        .single();

      if (!inv) return NextResponse.json({ error: "Investor not found" }, { status: 404 });

      const { data: prop } = await supabaseAdmin
        .from("ds_properties")
        .select("owner_id")
        .eq("id", (inv as any).property_id)
        .single();

      if (!(prop as any) || (prop as any).owner_id !== user.id) {
        return NextResponse.json({ error: "Investor does not belong to your property" }, { status: 403 });
      }
    }

    // Create account
    const insertPayload: any = {
      org_id: org.id,
      email,
      name,
      investor_id: investorId,
    };

    if (password) {
      insertPayload.password_hash = hashPassword(password);
    }

    const { data: account, error: insertError } = await supabaseAdmin
      .from("ds_lp_accounts")
      .insert(insertPayload)
      .select("id, org_id, investor_id, email, name, created_at")
      .single();

    if (insertError) {
      console.error("LP account create error:", insertError);
      return NextResponse.json({ error: "Failed to create LP account" }, { status: 500 });
    }

    // Send invite email with magic link
    let inviteSent = false;
    if (sendInvite) {
      try {
        const magicToken = await generateMagicLink(org.id, email);
        if (magicToken) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";
          const baseUrl = org.custom_domain && org.domain_verified
            ? `https://${org.custom_domain}`
            : `${appUrl}/portal/${org.slug}`;

          const magicUrl = `${baseUrl}?token=${magicToken}`;

          // Load branding for styled email
          const { data: branding } = await supabaseAdmin
            .from("ds_org_branding")
            .select("*")
            .eq("org_id", org.id)
            .single();

          const b = branding as any;
          const primaryColor = b?.primary_color || "#0D9488";
          const senderName = b?.email_sender_name || org.name;
          const portalTitle = b?.portal_title || org.name;
          const logoHtml = b?.logo_url
            ? `<img src="${b.logo_url}" alt="${org.name}" style="height:40px;margin-bottom:24px;">`
            : `<h2 style="color:${primaryColor};margin-bottom:24px;">${org.name}</h2>`;

          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: `${senderName} <noreply@deedslice.com>`,
            to: email,
            subject: `You've been invited to ${portalTitle}`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                ${logoHtml}
                <p style="font-size:14px;line-height:1.7;color:#333;">
                  ${name ? `Hi ${name},<br><br>` : ""}You've been invited to access your investor portal at <strong>${portalTitle}</strong>.
                </p>
                <p style="font-size:14px;line-height:1.7;color:#333;">
                  Click below to sign in and view your investments:
                </p>
                <a href="${magicUrl}" style="display:inline-block;background:${primaryColor};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">
                  Access Your Portal →
                </a>
                <p style="font-size:12px;color:#999;margin-top:24px;">
                  This link expires in 15 minutes. After that, you can request a new one from the login page.
                </p>
                ${password ? `<p style="font-size:12px;color:#999;">You can also sign in with your email and the password provided to you.</p>` : ""}
                ${b?.show_powered_by !== false ? `<p style="font-size:10px;color:#ccc;margin-top:32px;">Powered by DeedSlice</p>` : ""}
              </div>
            `,
          });
          inviteSent = true;
        }
      } catch (emailErr) {
        console.error("Invite email failed:", emailErr);
        // Account was still created — just note the invite failed
      }
    }

    return NextResponse.json({ ok: true, account, inviteSent });
  } catch (err) {
    console.error("LP account create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── UPDATE ──────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const org = await getOrgForUser(user.id);
    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await req.json();
    const { accountId, name, password, investorId, resetPassword } = body;

    if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });

    // Verify account belongs to org
    const { data: account } = await supabaseAdmin
      .from("ds_lp_accounts")
      .select("*")
      .eq("id", accountId)
      .eq("org_id", org.id)
      .single();

    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const updatePayload: any = {};

    if (name !== undefined) updatePayload.name = name ? sanitizeText(name, 200) : null;
    if (investorId !== undefined) updatePayload.investor_id = investorId || null;
    if (password) updatePayload.password_hash = hashPassword(password);

    // Reset password = clear hash (forces magic link login)
    if (resetPassword) {
      updatePayload.password_hash = null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await supabaseAdmin
      .from("ds_lp_accounts")
      .update(updatePayload)
      .eq("id", accountId);

    // If resetting password, send a fresh magic link
    let magicLinkSent = false;
    if (resetPassword) {
      try {
        const magicToken = await generateMagicLink(org.id, (account as any).email);
        if (magicToken) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";
          const baseUrl = org.custom_domain && org.domain_verified
            ? `https://${org.custom_domain}`
            : `${appUrl}/portal/${org.slug}`;

          const magicUrl = `${baseUrl}?token=${magicToken}`;

          const { data: branding } = await supabaseAdmin
            .from("ds_org_branding")
            .select("primary_color, email_sender_name, logo_url, show_powered_by, portal_title")
            .eq("org_id", org.id)
            .single();

          const b = branding as any;
          const primaryColor = b?.primary_color || "#0D9488";
          const senderName = b?.email_sender_name || org.name;

          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: `${senderName} <noreply@deedslice.com>`,
            to: (account as any).email,
            subject: `Password reset — ${b?.portal_title || org.name}`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
                <p style="font-size:14px;line-height:1.7;color:#333;">
                  Your password has been reset. Click below to sign in:
                </p>
                <a href="${magicUrl}" style="display:inline-block;background:${primaryColor};color:#fff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;margin:16px 0;">
                  Sign In →
                </a>
                <p style="font-size:12px;color:#999;margin-top:24px;">This link expires in 15 minutes.</p>
              </div>
            `,
          });
          magicLinkSent = true;
        }
      } catch (emailErr) {
        console.error("Password reset email failed:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, magicLinkSent });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE ──────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const org = await getOrgForUser(user.id);
    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const accountId = req.nextUrl.searchParams.get("id");
    if (!accountId) return NextResponse.json({ error: "Missing account id" }, { status: 400 });

    const { error: delError } = await supabaseAdmin
      .from("ds_lp_accounts")
      .delete()
      .eq("id", accountId)
      .eq("org_id", org.id);

    if (delError) {
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
