import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendUpgradeEmail } from "@/lib/email";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-12-18.acacia" as any });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
    // ─── Checkout completed (subscriptions + one-time payments) ───
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan;           // "pro" | "enterprise"
      const type = session.metadata?.type;            // "tokenization_credits"
      const subscriptionId = session.subscription as string;

      // ── Plan subscription activated (Operator $299/mo or Enterprise $50K/yr) ──
      if (userId && plan && (plan === "pro" || plan === "enterprise")) {
        const updatePayload: any = {
          plan,
          properties_limit: 999,
          stripe_subscription_id: subscriptionId,
        };

        await supabaseAdmin
          .from("ds_profiles")
          .update(updatePayload)
          .eq("id", userId);

        // Send upgrade email
        const { data: profile } = await supabaseAdmin
          .from("ds_profiles")
          .select("email")
          .eq("id", userId)
          .single();

        if (profile && (profile as any).email) {
          sendUpgradeEmail((profile as any).email, plan).catch((err) =>
            console.error("Upgrade email failed:", err)
          );
        }

        console.log(`Plan upgraded to ${plan} for user ${userId} (sub: ${subscriptionId})`);
      }

      // ── Tokenization credit purchase ($1,499 single / $4,999 5-pack) ──
      if (userId && type === "tokenization_credits") {
        const creditCount = parseInt(session.metadata?.credit_count || "1", 10);

        // Read current credits then increment (Supabase doesn't have atomic increment)
        const { data: currentProfile } = await supabaseAdmin
          .from("ds_profiles")
          .select("tokenization_credits")
          .eq("id", userId)
          .single();

        const currentCredits = (currentProfile as any)?.tokenization_credits || 0;

        await supabaseAdmin
          .from("ds_profiles")
          .update({ tokenization_credits: currentCredits + creditCount } as any)
          .eq("id", userId);

        console.log(`Added ${creditCount} tokenization credit(s) to user ${userId} (total: ${currentCredits + creditCount})`);
      }
      break;
    }

    // ─── Subscription cancelled → downgrade to Sandbox ───
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const { data: profiles } = await supabaseAdmin
        .from("ds_profiles")
        .select("id")
        .eq("stripe_subscription_id", sub.id);

      if ((profiles as any)?.[0]) {
        await supabaseAdmin.from("ds_profiles").update({
          plan: "starter",
          properties_limit: 999,
          stripe_subscription_id: null,
          // Note: tokenization_credits are kept — they paid for those separately
        } as any).eq("id", (profiles as any)[0].id);

        console.log(`Subscription ${sub.id} cancelled — user ${(profiles as any)[0].id} downgraded to Sandbox`);
      }
      break;
    }

    // ─── Payment failed on recurring invoice ───
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`Payment failed for customer ${invoice.customer} — invoice ${invoice.id}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
