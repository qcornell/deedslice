import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 per hour per user
    const rateLimitRes = applyRateLimit(req.headers, "ai-draft-email", { max: 20, windowSec: 3600 });
    if (rateLimitRes) return rateLimitRes;

    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const { propertyId, distributionPeriod } = await req.json();

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // Verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("id, name, address, owner_id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Get distributions for this period
    let distQuery = supabaseAdmin
      .from("ds_distributions")
      .select("id, investor_id, amount_usd, period, created_at, status")
      .eq("property_id", propertyId);

    if (distributionPeriod) {
      distQuery = distQuery.eq("period", distributionPeriod);
    }

    const { data: distributions } = await distQuery;

    if (!distributions || distributions.length === 0) {
      return NextResponse.json({ error: "No distributions found for this period" }, { status: 404 });
    }

    // Get investor details
    const investorIds = [...new Set(distributions.map((d: any) => d.investor_id))];
    const { data: investors } = await supabaseAdmin
      .from("ds_investors")
      .select("id, name, email, slices_owned, percentage")
      .in("id", investorIds);

    const investorMap = new Map((investors || []).map((i: any) => [i.id, i]));

    const totalAmount = distributions.reduce((s: number, d: any) => s + Number(d.amount_usd), 0);
    const distributionDate = distributions[0]?.created_at
      ? new Date(distributions[0].created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    const investorBreakdown = distributions
      .map((d: any) => {
        const inv = investorMap.get(d.investor_id);
        return inv
          ? `- ${inv.name}: $${Number(d.amount_usd).toFixed(2)} (${inv.percentage}% ownership)`
          : null;
      })
      .filter(Boolean)
      .join("\n");

    const userMessage = `Property: ${property.name}
Address: ${property.address || "N/A"}
Distribution Date: ${distributionDate}
Period: ${distributionPeriod || "N/A"}
Total Amount Distributed: $${totalAmount.toFixed(2)}
Number of Investors: ${investorIds.length}

Per-investor breakdown:
${investorBreakdown}`;

    const systemPrompt = `You are a professional real estate investment communications assistant. Draft a concise, professional email from a property sponsor to their investors announcing a rent distribution. Tone should be warm but businesslike. Include: the property name, distribution date, total amount distributed, and a note that each investor can view their individual amount in their investor portal. Keep it under 200 words. Do not use crypto/blockchain jargon. Sign off with [Sponsor Name] as a placeholder.`;

    // Call OpenAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error("OpenAI API error:", errBody);
      return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const email = aiData.choices?.[0]?.message?.content?.trim() || "";
    const promptTokens = aiData.usage?.prompt_tokens || 0;
    const completionTokens = aiData.usage?.completion_tokens || 0;

    // Log usage
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: user.id,
      feature: "draft-distribution-email",
      model: "gpt-4o-mini",
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    });

    return NextResponse.json({ email });
  } catch (err) {
    console.error("Draft email error:", err);
    return NextResponse.json({ error: "Failed to generate email" }, { status: 500 });
  }
}
