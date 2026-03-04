import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import type { Profile } from "@/types/database";

/**
 * GET  /api/org — Get user's organization + branding + settings
 * POST /api/org — Create organization (Enterprise only)
 * PATCH /api/org — Update organization branding/settings
 */

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: org } = await supabaseAdmin
      .from("ds_organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org) return NextResponse.json({ org: null, branding: null, settings: null });

    const [brandingRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("ds_org_branding").select("*").eq("org_id", (org as any).id).single(),
      supabaseAdmin.from("ds_org_settings").select("*").eq("org_id", (org as any).id).single(),
    ]);

    return NextResponse.json({
      org,
      branding: brandingRes.data || null,
      settings: settingsRes.data || null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "create-org", { max: 3, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Enterprise only
    const { data: profile } = await supabaseAdmin
      .from("ds_profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    if (!(profile as Profile)?.plan || (profile as Profile).plan !== "enterprise") {
      return NextResponse.json({ error: "White-label requires Enterprise plan." }, { status: 403 });
    }

    // Check if already has an org
    const { data: existing } = await supabaseAdmin
      .from("ds_organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Organization already exists. Use PATCH to update." }, { status: 400 });
    }

    const body = await req.json();
    const { name, slug } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Missing name or slug" }, { status: 400 });
    }

    // Validate slug format
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) {
      return NextResponse.json({ error: "Slug must be 3-50 lowercase alphanumeric characters or hyphens" }, { status: 400 });
    }

    // Check slug availability
    const { data: slugTaken } = await supabaseAdmin
      .from("ds_organizations")
      .select("id")
      .eq("slug", slug)
      .single();

    if (slugTaken) {
      return NextResponse.json({ error: "This slug is already taken" }, { status: 400 });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");

    // Create org
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("ds_organizations")
      .insert({
        owner_id: user.id,
        name,
        slug,
        domain_verification_token: verificationToken,
      } as any)
      .select()
      .single();

    if (orgErr || !org) {
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    // Create default branding
    await supabaseAdmin.from("ds_org_branding").insert({
      org_id: (org as any).id,
    } as any);

    // Create default settings
    await supabaseAdmin.from("ds_org_settings").insert({
      org_id: (org as any).id,
    } as any);

    // Link existing properties to this org
    await supabaseAdmin
      .from("ds_properties")
      .update({ org_id: (org as any).id } as any)
      .eq("owner_id", user.id)
      .is("org_id", null);

    return NextResponse.json({ org, verificationToken });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: org } = await supabaseAdmin
      .from("ds_organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const body = await req.json();
    const { branding, settings, custom_domain } = body;

    // Update org-level fields
    if (custom_domain !== undefined) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      await supabaseAdmin
        .from("ds_organizations")
        .update({
          custom_domain: custom_domain || null,
          domain_verified: false,
          domain_verification_token: verificationToken,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", (org as any).id);
    }

    // Update branding
    if (branding) {
      const allowed = [
        "logo_url", "favicon_url", "primary_color", "secondary_color",
        "accent_color", "text_color", "bg_color", "email_sender_name",
        "portal_title", "footer_text", "show_powered_by",
      ];
      const clean: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (key in branding) clean[key] = branding[key];
      }
      await supabaseAdmin
        .from("ds_org_branding")
        .update(clean as any)
        .eq("org_id", (org as any).id);
    }

    // Update settings
    if (settings) {
      const allowed = [
        "require_kyc_for_transfer", "allow_investor_self_register",
        "default_property_visibility", "timezone", "currency",
      ];
      const clean: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const key of allowed) {
        if (key in settings) clean[key] = settings[key];
      }
      await supabaseAdmin
        .from("ds_org_settings")
        .update(clean as any)
        .eq("org_id", (org as any).id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
