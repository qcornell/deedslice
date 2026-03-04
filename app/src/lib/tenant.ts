/**
 * Tenant Resolution & Branding
 *
 * Resolves the current tenant from:
 *   1. Custom domain header (X-Forwarded-Host or Host)
 *   2. Slug in URL path (/portal/[slug]/...)
 *
 * Returns the full branding config as CSS custom properties
 * so the entire UI skins itself from one data source.
 */

import { supabaseAdmin } from "@/lib/supabase/server";
import type { Organization, OrgBranding, OrgSettings } from "@/types/database";

export interface TenantConfig {
  org: Organization;
  branding: OrgBranding;
  settings: OrgSettings;
}

const DEFAULT_BRANDING: Omit<OrgBranding, "id" | "org_id" | "updated_at"> = {
  logo_url: null,
  favicon_url: null,
  primary_color: "#0D9488",
  secondary_color: "#0F172A",
  accent_color: "#6366F1",
  text_color: "#0F172A",
  bg_color: "#F8FAFC",
  email_sender_name: null,
  portal_title: null,
  footer_text: "Powered by DeedSlice",
  show_powered_by: true,
};

const DEFAULT_SETTINGS: Omit<OrgSettings, "id" | "org_id" | "updated_at"> = {
  require_kyc_for_transfer: false,
  allow_investor_self_register: false,
  default_property_visibility: "private",
  timezone: "America/Chicago",
  currency: "USD",
};

/**
 * Resolve tenant by slug.
 */
export async function getTenantBySlug(slug: string): Promise<TenantConfig | null> {
  const { data: org } = await supabaseAdmin
    .from("ds_organizations")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!org) return null;
  return loadTenantConfig(org as Organization);
}

/**
 * Resolve tenant by custom domain.
 */
export async function getTenantByDomain(domain: string): Promise<TenantConfig | null> {
  const { data: org } = await supabaseAdmin
    .from("ds_organizations")
    .select("*")
    .eq("custom_domain", domain)
    .eq("domain_verified", true)
    .single();

  if (!org) return null;
  return loadTenantConfig(org as Organization);
}

/**
 * Resolve tenant from request headers (custom domain) or slug.
 */
export async function resolveTenant(
  headers: Headers,
  slug?: string
): Promise<TenantConfig | null> {
  // Try custom domain first
  const host = headers.get("x-forwarded-host") || headers.get("host") || "";
  if (host && !host.includes("deedslice.com") && !host.includes("localhost") && !host.includes("vercel.app")) {
    const tenant = await getTenantByDomain(host);
    if (tenant) return tenant;
  }

  // Fall back to slug
  if (slug) {
    return getTenantBySlug(slug);
  }

  return null;
}

async function loadTenantConfig(org: Organization): Promise<TenantConfig> {
  const [brandingRes, settingsRes] = await Promise.all([
    supabaseAdmin.from("ds_org_branding").select("*").eq("org_id", org.id).single(),
    supabaseAdmin.from("ds_org_settings").select("*").eq("org_id", org.id).single(),
  ]);

  const branding: OrgBranding = brandingRes.data
    ? (brandingRes.data as OrgBranding)
    : { id: "", org_id: org.id, updated_at: "", ...DEFAULT_BRANDING } as OrgBranding;

  const settings: OrgSettings = settingsRes.data
    ? (settingsRes.data as OrgSettings)
    : { id: "", org_id: org.id, updated_at: "", ...DEFAULT_SETTINGS } as OrgSettings;

  return { org, branding, settings };
}

/**
 * Generate CSS custom properties from branding config.
 * Inject these into the LP portal <style> tag.
 */
export function brandingToCssVars(b: OrgBranding): string {
  return `
    --lp-primary: ${b.primary_color};
    --lp-secondary: ${b.secondary_color};
    --lp-accent: ${b.accent_color};
    --lp-text: ${b.text_color};
    --lp-bg: ${b.bg_color};
  `.trim();
}
