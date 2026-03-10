import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Next.js Middleware — Server-side route protection + Custom Domain Resolution
 *
 * Handles:
 *   1. Security headers on all responses
 *   2. Custom domain → portal rewrite (white-label)
 *      If the Host header is a verified custom domain in ds_organizations,
 *      rewrite all requests to /portal/[slug]/... so the LP portal renders
 *      under the client's own domain with zero DeedSlice branding in the URL.
 *   3. Dashboard auth (client-side via useAuth hook)
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── In-memory cache for custom domain → slug lookups ──
// Avoids hitting Supabase on every request. TTL: 5 minutes.
const domainCache = new Map<string, { slug: string; ts: number }>();
const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Known DeedSlice domains — never treat these as custom domains
const INTERNAL_HOSTS = ["deedslice.com", "console.deedslice.com", "localhost", "vercel.app"];

function isInternalHost(host: string): boolean {
  return INTERNAL_HOSTS.some(h => host === h || host.endsWith("." + h));
}

/**
 * Look up a custom domain → org slug.
 * Returns the slug if found and domain is verified, else null.
 */
async function resolveCustomDomain(domain: string): Promise<string | null> {
  // Check cache first
  const cached = domainCache.get(domain);
  if (cached && Date.now() - cached.ts < DOMAIN_CACHE_TTL_MS) {
    return cached.slug;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
      .from("ds_organizations")
      .select("slug")
      .eq("custom_domain", domain)
      .eq("domain_verified", true)
      .single();

    if (data?.slug) {
      domainCache.set(domain, { slug: data.slug, ts: Date.now() });
      return data.slug;
    }
  } catch {
    // Query failed — don't cache the failure, just pass through
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Security headers (applied to all responses) ──
  const secHeaders: Record<string, string> = {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  // ── Custom Domain Resolution ──
  // If the request is coming from a non-DeedSlice host, check if it's
  // a verified custom domain and rewrite to the portal path.
  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(":")[0].toLowerCase();

  if (host && !isInternalHost(host)) {
    const slug = await resolveCustomDomain(host);

    if (slug) {
      // Rewrite the URL to /portal/[slug]/... while keeping the original host visible
      // Skip rewriting if already on a portal path or an API/static path
      if (!pathname.startsWith("/portal/") && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
        // Map root "/" → "/portal/[slug]/"
        // Map "/dashboard" → "/portal/[slug]/dashboard"
        // Map "/auth/verify" → "/portal/[slug]/auth/verify"
        const portalPath = pathname === "/" ? `/portal/${slug}` : `/portal/${slug}${pathname}`;
        const url = req.nextUrl.clone();
        url.pathname = portalPath;

        const res = NextResponse.rewrite(url);
        for (const [k, v] of Object.entries(secHeaders)) res.headers.set(k, v);
        return res;
      }

      // For API routes under custom domain, pass through but add a header
      // so API handlers can identify the tenant
      if (pathname.startsWith("/api/")) {
        const res = NextResponse.next();
        res.headers.set("x-ds-tenant-slug", slug);
        for (const [k, v] of Object.entries(secHeaders)) res.headers.set(k, v);
        return res;
      }
    }
    // If custom domain not found, let it fall through to 404 naturally
  }

  // ── Default: pass through with security headers ──
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(secHeaders)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match ALL paths so custom domain resolution works everywhere.
     * Exclude only truly static assets that never need middleware:
     *   - _next/static (bundled JS/CSS)
     *   - _next/image (optimized images)
     *   - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)",
  ],
};
