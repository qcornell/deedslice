import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendUpgradeEmail } from "@/lib/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PLAN_LIMITS: Record<string, number> = { pro: 5, enterprise: 999 };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;
      const subscriptionId = session.subscription as string;
      if (userId && plan) {
        await supabaseAdmin.from("ds_profiles").update({
          plan,
          properties_limit: PLAN_LIMITS[plan] || 1,
          stripe_subscription_id: subscriptionId,
        } as any).eq("id", userId);

        // Send upgrade email
        const { data: profile } = await supabaseAdmin.from("ds_profiles").select("email").eq("id", userId).single();
        if (profile && (profile as any).email) {
          sendUpgradeEmail((profile as any).email, plan).catch((err) =>
            console.error("Upgrade email failed:", err)
          );
        }
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: profiles } = await supabaseAdmin.from("ds_profiles").select("id").eq("stripe_subscription_id", sub.id);
      if ((profiles as any)?.[0]) {
        await supabaseAdmin.from("ds_profiles").update({
          plan: "starter",
          properties_limit: 1,
          stripe_subscription_id: null,
        } as any).eq("id", (profiles as any)[0].id);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`Payment failed for customer ${invoice.customer}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
