import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import Stripe from "stripe";
import type { Profile } from "@/types/database";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data } = await supabaseAdmin.from("ds_profiles").select("*").eq("id", user.id).single();
    let profile = data as Profile | null;

    if (!profile) {
      const { data: newProfile } = await supabaseAdmin
        .from("ds_profiles")
        .insert({ id: user.id, email: user.email || "", plan: "starter", properties_used: 0, properties_limit: 1 } as any)
        .select().single();
      profile = newProfile as Profile | null;
      if (!profile) return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    if (profile.plan === "starter") {
      return NextResponse.json({ free: true, message: "Starter plan — first property is free" });
    }

    let customerId = profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from("ds_profiles").update({ stripe_customer_id: customerId } as any).eq("id", user.id);
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 19900,
      currency: "usd",
      customer: customerId,
      description: "DeedSlice — Property Tokenization",
      metadata: { supabase_user_id: user.id, type: "property_tokenization" },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, amount: 19900 });
  } catch (err: any) {
    console.error("Payment error:", err);
    return NextResponse.json({ error: "Payment processing failed. Please try again." }, { status: 500 });
  }
}
