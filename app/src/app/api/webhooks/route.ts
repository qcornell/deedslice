import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import type { Profile } from "@/types/database";

/**
 * GET  /api/webhooks — List user's webhooks
 * POST /api/webhooks — Create a webhook endpoint
 * DELETE /api/webhooks — Delete a webhook by id
 */

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: webhooks } = await supabaseAdmin
      .from("ds_webhooks")
      .select("id, url, events, active, last_triggered_at, failure_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ webhooks: webhooks || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const blocked = applyRateLimit(req.headers, "create-webhook", { max: 10, windowSec: 3600 });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Check plan
    const { data: profileData } = await supabaseAdmin
      .from("ds_profiles")
      .select("plan")
      .eq("id", user.id)
      .single();
    const profile = profileData as Profile | null;

    if (!profile || profile.plan !== "enterprise") {
      return NextResponse.json({ error: "Webhooks require Enterprise plan." }, { status: 403 });
    }

    const body = await req.json();
    const { url, events } = body as { url: string; events?: string[] };

    if (!url) return NextResponse.json({ error: "Missing webhook URL" }, { status: 400 });

    // Validate URL
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Webhook URL must use HTTPS" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    // Generate signing secret
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    // Max 5 webhooks per user
    const { count } = await supabaseAdmin
      .from("ds_webhooks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: "Maximum 5 webhooks per account." }, { status: 400 });
    }

    const validEvents = [
      "property.tokenized", "investor.added", "investor.updated", "investor.removed",
      "transfer.completed", "transfer.failed", "document.added", "kyc.updated",
    ];
    const filteredEvents = (events || []).filter((e: string) => validEvents.includes(e));

    const { data: webhook } = await supabaseAdmin
      .from("ds_webhooks")
      .insert({
        user_id: user.id,
        url,
        events: filteredEvents.length > 0 ? filteredEvents : validEvents,
        secret,
      } as any)
      .select("id, url, events, active, created_at")
      .single();

    return NextResponse.json({
      webhook,
      secret,
      message: "Save this signing secret — it won't be shown again. Use it to verify webhook payloads with HMAC-SHA256.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error } = await getUserFromToken(token);
    if (error || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing webhook id" }, { status: 400 });

    await supabaseAdmin
      .from("ds_webhooks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
