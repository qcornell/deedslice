import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import type { Profile } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });

/**
 * Tokenization credit pricing (one-time payments):
 *   1 credit:  $1,499
 *   5 credits: $4,999  (~$1,000/credit — 33% savings)
 *
 * Enterprise users have unlimited tokenization included.
 * Sandbox (starter) users are on testnet (free, no credits needed).
 * Operator (pro) users must have tokenization credits to deploy on mainnet.
 */
const TOKENIZE_SINGLE_PRICE_ID = process.env.STRIPE_PRICE_TOKENIZE_SINGLE || "price_1T7wHuCmXrnPCTDORVvvuZjy";
const TOKENIZE_5PACK_PRICE_ID = process.env.STRIPE_PRICE_TOKENIZE_5PACK || "price_1T7wIlCmXrnPCTDOYOW6Rnbs";

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

    // Enterprise users — unlimited tokenization, no credits needed
    if (profile.plan === "enterprise") {
      return NextResponse.json({ free: true, message: "Enterprise plan — tokenization included" });
    }

    // Sandbox users — testnet is free, no credits needed
    if (profile.plan === "starter") {
      return NextResponse.json({ free: true, message: "Sandbox — testnet tokenization is free" });
    }

    const body = await req.json().catch(() => ({}));
    const pack = body.pack as "single" | "5pack" | undefined;
    const propertyName = body.propertyName || "Property";

    // If operator has credits and isn't explicitly buying a pack, use existing credit
    const credits = (profile as any).tokenization_credits || 0;
    if (credits > 0 && !pack) {
      return NextResponse.json({ free: true, message: `Using 1 of ${credits} tokenization credit${credits !== 1 ? "s" : ""}` });
    }

    // Determine which price to use
    const priceId = pack === "5pack" ? TOKENIZE_5PACK_PRICE_ID : TOKENIZE_SINGLE_PRICE_ID;
    const creditCount = pack === "5pack" ? 5 : 1;

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

    // Tokenization credits are one-time payments
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: pack === "5pack"
        ? `${appUrl}/dashboard/settings?credits_purchased=5`
        : `${appUrl}/dashboard/new?tokenize_paid=true`,
      cancel_url: pack === "5pack"
        ? `${appUrl}/dashboard/settings?credits_cancelled=true`
        : `${appUrl}/dashboard/new?tokenize_cancelled=true`,
      metadata: {
        supabase_user_id: user.id,
        type: "tokenization_credits",
        credit_count: String(creditCount),
        property_name: propertyName,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Tokenize checkout error:", err);
    return NextResponse.json({ error: "Failed to create payment session. Please try again." }, { status: 500 });
  }
}
