/**
 * Webhook Delivery System
 *
 * Fires webhooks to registered URLs when events occur.
 * Signs payloads with HMAC-SHA256 using the webhook's secret.
 * Retries once on failure. Disables after 10 consecutive failures.
 */

import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase/server";

export type WebhookEvent =
  | "property.tokenized"
  | "investor.added"
  | "investor.updated"
  | "investor.removed"
  | "transfer.completed"
  | "transfer.failed"
  | "document.added"
  | "kyc.updated";

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Fire webhooks for a given user + event.
 * Runs async — does not block the caller.
 */
export async function fireWebhooks(
  userId: string,
  event: WebhookEvent,
  data: Record<string, any>
): Promise<void> {
  try {
    const { data: webhooks } = await supabaseAdmin
      .from("ds_webhooks")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    if (!webhooks || webhooks.length === 0) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const body = JSON.stringify(payload);

    for (const wh of webhooks as any[]) {
      // Check if this webhook is subscribed to this event
      if (wh.events.length > 0 && !wh.events.includes(event)) continue;

      const signature = signPayload(body, wh.secret);

      deliverWebhook(wh, body, signature).catch(() => {});
    }
  } catch (err) {
    console.error("Webhook dispatch error:", err);
  }
}

async function deliverWebhook(
  wh: any,
  body: string,
  signature: string,
  retry = true
): Promise<void> {
  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DeedSlice-Signature": signature,
        "X-DeedSlice-Event": JSON.parse(body).event,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (res.ok) {
      // Reset failure count on success
      await supabaseAdmin
        .from("ds_webhooks")
        .update({
          last_triggered_at: new Date().toISOString(),
          failure_count: 0,
        } as any)
        .eq("id", wh.id);
      return;
    }

    throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const newCount = (wh.failure_count || 0) + 1;

    // Disable after 10 consecutive failures
    await supabaseAdmin
      .from("ds_webhooks")
      .update({
        failure_count: newCount,
        active: newCount < 10,
        last_triggered_at: new Date().toISOString(),
      } as any)
      .eq("id", wh.id);

    // One retry
    if (retry) {
      await new Promise((r) => setTimeout(r, 2000));
      return deliverWebhook({ ...wh, failure_count: newCount }, body, signature, false);
    }
  }
}
