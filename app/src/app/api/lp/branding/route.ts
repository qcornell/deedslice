import { NextRequest, NextResponse } from "next/server";
import { getTenantBySlug } from "@/lib/tenant";

/**
 * GET /api/lp/branding?slug=xxx — Public endpoint, returns branding for LP portal shell
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    org_name: tenant.org.name,
    logo_url: tenant.branding.logo_url,
    favicon_url: tenant.branding.favicon_url,
    primary_color: tenant.branding.primary_color,
    secondary_color: tenant.branding.secondary_color,
    accent_color: tenant.branding.accent_color,
    text_color: tenant.branding.text_color,
    bg_color: tenant.branding.bg_color,
    portal_title: tenant.branding.portal_title,
    footer_text: tenant.branding.footer_text,
    show_powered_by: tenant.branding.show_powered_by,
  });
}
