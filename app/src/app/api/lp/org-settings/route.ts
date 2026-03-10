import { NextRequest, NextResponse } from "next/server";
import { getTenantBySlug } from "@/lib/tenant";

/**
 * GET /api/lp/org-settings?slug=xxx — Public endpoint, returns public org settings
 *
 * Only exposes non-sensitive settings needed by the portal UI.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    allow_investor_self_register: tenant.settings.allow_investor_self_register,
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
