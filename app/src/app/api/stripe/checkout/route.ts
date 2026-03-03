import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import Stripe from "stripe";
import type { Profile } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });

/**
 * Use existing Stripe Price IDs (created in Stripe Dashboard).
 * Pro: $99.99/mo  |  Enterprise: $499.99/mo
 */
const PLANS: Record<string, { priceId: string; propertiesLimit: number }> = {
  pro: { priceId: "price_1T6YXyCmXrnPCTDOn3yBZPOG", propertiesLimit: 5 },
  enterprise: { priceId: "price_1T6YcBCmXrnPCTDOEAnT0uVU", propertiesLimit: 999 },
};

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: err.message || "Stripe error" }, { status: 500 });
  }
}
