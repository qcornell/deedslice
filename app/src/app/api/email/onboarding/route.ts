import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/email/onboarding — Send onboarding drip emails
 * 
 * Called by cron job (or manually). Finds users who:
 *   - Signed up 2 days ago but haven't tokenized → sends "explore" email
 *   - Signed up 5 days ago, still on Sandbox → sends "upgrade" email
 * 
 * Protected by a secret header to prevent abuse.
 */

const CRON_SECRET = process.env.CRON_SECRET || process.env.LP_JWT_SECRET;

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { getResend } = await import("@/lib/email-onboarding");

    const now = new Date();
    const results = { day2Sent: 0, day5Sent: 0, errors: 0 };

    // ── Day 2: "Here's what you can do" ──
    // Users who signed up ~2 days ago and have 0 properties
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const twoDaysWindow = new Date(twoDaysAgo.getTime() - 4 * 60 * 60 * 1000); // 4-hour window

    const { data: day2Users } = await supabaseAdmin
      .from("ds_profiles")
      .select("id, email, full_name, properties_used")
      .gte("created_at", twoDaysWindow.toISOString())
      .lte("created_at", twoDaysAgo.toISOString())
      .eq("properties_used", 0);

    for (const user of (day2Users || [])) {
      try {
        const { sendDay2Email } = await import("@/lib/email-onboarding");
        await sendDay2Email((user as any).email, (user as any).full_name);
        results.day2Sent++;
      } catch (err) {
        console.error("Day 2 email failed:", (user as any).email, err);
        results.errors++;
      }
    }

    // ── Day 5: "Ready for mainnet?" ──
    // Users who signed up ~5 days ago and are still on Sandbox
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const fiveDaysWindow = new Date(fiveDaysAgo.getTime() - 4 * 60 * 60 * 1000);

    const { data: day5Users } = await supabaseAdmin
      .from("ds_profiles")
      .select("id, email, full_name, plan, properties_used")
      .gte("created_at", fiveDaysWindow.toISOString())
      .lte("created_at", fiveDaysAgo.toISOString())
      .eq("plan", "starter");

    for (const user of (day5Users || [])) {
      try {
        const { sendDay5Email } = await import("@/lib/email-onboarding");
        const hasTokenized = (user as any).properties_used > 0;
        await sendDay5Email((user as any).email, (user as any).full_name, hasTokenized);
        results.day5Sent++;
      } catch (err) {
        console.error("Day 5 email failed:", (user as any).email, err);
        results.errors++;
      }
    }

    console.log("Onboarding drip results:", results);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    console.error("Onboarding email error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
