import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import type { Profile } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });

/**
 * Stripe Price IDs (set in Stripe Dashboard, wired via env vars).
 * Operator: $299/mo (subscription)
 * Enterprise: $50,000/yr (subscription)
 */
const PLANS: Record<string, { priceId: string; propertiesLimit: number }> = {
  pro: {
    priceId: process.env.STRIPE_PRICE_OPERATOR || "price_1T7wDbCmXrnPCTDO45KHdLit",
    propertiesLimit: 999,
  },
  enterprise: {
    priceId: process.env.STRIPE_PRICE_ENTERPRISE || "price_1T7wGKCmXrnPCTDOmeRoq84J",
    propertiesLimit: 999,
  },
};

export async function POST(req: NextRequest) {
  // Rate limit: 5 checkout sessions per IP per hour
  const blocked = applyRateLimit(req.headers, "stripe-checkout", { max: 5, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { plan } = await req.json();
    if (!plan || !(plan in PLANS)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const planInfo = PLANS[plan];

    const { data } = await supabaseAdmin.from("ds_profiles").select("*").eq("id", user.id).single();
    const profile = data as Profile | null;

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from("ds_profiles").update({ stripe_customer_id: customerId } as any).eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";

    // Both Operator and Enterprise are subscription mode
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: planInfo.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings?upgraded=${plan}`,
      cancel_url: `${appUrl}/dashboard/settings?cancelled=true`,
      metadata: { supabase_user_id: user.id, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 500 });
  }
}
