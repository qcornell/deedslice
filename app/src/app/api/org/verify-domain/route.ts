import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import dns from "dns/promises";

/**
 * POST /api/org/verify-domain — Verify custom domain ownership
 *
 * Operator must add a TXT record:
 *   _deedslice-verify.invest.clientname.com → ds-verify=<token>
 *
 * Or a CNAME:
 *   invest.clientname.com → portal.deedslice.com
 */
export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "verify-domain", { max: 10, windowSec: 3600 });
  if (blocked) return blocked;

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

    if (!org) return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const orgData = org as any;
    if (!orgData.custom_domain) {
      return NextResponse.json({ error: "No custom domain configured" }, { status: 400 });
    }

    if (orgData.domain_verified) {
      return NextResponse.json({ ok: true, verified: true, message: "Domain already verified" });
    }

    // Check TXT record
    const txtHost = `_deedslice-verify.${orgData.custom_domain}`;
    const expectedValue = `ds-verify=${orgData.domain_verification_token}`;

    let verified = false;

    try {
      const records = await dns.resolveTxt(txtHost);
      const flat = records.map(r => r.join(""));
      if (flat.includes(expectedValue)) {
        verified = true;
      }
    } catch {
      // TXT lookup failed — try CNAME fallback
    }

    if (!verified) {
      // Check CNAME as fallback
      try {
        const cnames = await dns.resolveCname(orgData.custom_domain);
        if (cnames.some(c => c === "portal.deedslice.com" || c === "portal.deedslice.com.")) {
          verified = true;
        }
      } catch {
        // CNAME lookup failed too
      }
    }

    if (verified) {
      await supabaseAdmin
        .from("ds_organizations")
        .update({ domain_verified: true, updated_at: new Date().toISOString() } as any)
        .eq("id", orgData.id);

      return NextResponse.json({ ok: true, verified: true, message: "Domain verified successfully!" });
    }

    return NextResponse.json({
      ok: false,
      verified: false,
      message: "Verification failed. Add one of these DNS records:",
      instructions: {
        option1: {
          type: "TXT",
          host: txtHost,
          value: expectedValue,
        },
        option2: {
          type: "CNAME",
          host: orgData.custom_domain,
          value: "portal.deedslice.com",
        },
      },
    });
  } catch (err) {
    console.error("Domain verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
