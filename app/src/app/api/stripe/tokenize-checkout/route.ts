import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import type { Profile } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });

/** Per-property tokenization fee: $199.99 one-time */
const TOKENIZATION_PRICE_ID = "price_1T6YfHCmXrnPCTDOAW6xVbvD";

/**
 * POST /api/stripe/tokenize-checkout
 *
 * Creates a Stripe Checkout session for the per-property $199.99 tokenization fee.
 * Only required for Pro users on their 2nd+ property.
 * Enterprise users skip this entirely.
 * Starter users are on testnet (free).
 */
export async function POST(req: NextRequest) {
  // Rate limit: 5 checkout creations per IP per hour
  const blocked = applyRateLimit(req.headers, "tokenize-checkout", { max: 5, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: profileData } = await supabaseAdmin
      .from("ds_profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = profileData as Profile | null;

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Enterprise users don't pay per-property
    if (profile.plan === "enterprise") {
      return NextResponse.json({ free: true, message: "Enterprise plan — tokenization included" });
    }

    // Starter users are free (testnet sandbox)
    if (profile.plan === "starter") {
      return NextResponse.json({ free: true, message: "Starter plan — first property is free (testnet)" });
    }

    // Pro: first property is included, additional are $199.99
    if (profile.plan === "pro" && profile.properties_used < 1) {
      return NextResponse.json({ free: true, message: "First Pro property included" });
    }

    const body = await req.json().catch(() => ({}));
    const propertyName = body.propertyName || "Property";

    // Get or create Stripe customer
    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("ds_profiles")
        .update({ stripe_customer_id: customerId } as any)
        .eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price: TOKENIZATION_PRICE_ID,
        quantity: 1,
      }],
      success_url: `${appUrl}/dashboard/new?tokenize_paid=true`,
      cancel_url: `${appUrl}/dashboard/new?tokenize_cancelled=true`,
      metadata: {
        supabase_user_id: user.id,
        type: "property_tokenization",
        property_name: propertyName,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Tokenize checkout error:", err);
    return NextResponse.json({ error: err.message || "Stripe error" }, { status: 500 });
  }
}
