import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimit } from "@/lib/rate-limit";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 per hour per user
    const rateLimitRes = applyRateLimit(req.headers, "ai-investor-update", { max: 20, windowSec: 3600 });
    if (rateLimitRes) return rateLimitRes;

    // Auth
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
    }

    const { propertyId } = await req.json();

    if (!propertyId) {
      return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });
    }

    // Verify ownership
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("id, name, address, valuation_usd, total_slices, share_token_symbol, owner_id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    // Get distributions from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: distributions } = await supabaseAdmin
      .from("ds_distributions")
      .select("id, amount_usd, period, created_at, type, status")
      .eq("property_id", propertyId)
      .gte("created_at", ninetyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    // Get investor count
    const { count: investorCount } = await supabaseAdmin
      .from("ds_investors")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId);

    const totalDistributed = (distributions || []).reduce(
      (s: number, d: any) => s + Number(d.amount_usd),
      0
    );

    // Unique distribution periods
    const periods = Array.from(new Set((distributions || []).map((d: any) => d.period).filter(Boolean)));

    const distributionSummary = periods.length > 0
      ? periods
          .map((p) => {
            const periodDists = (distributions || []).filter((d: any) => d.period === p);
            const periodTotal = periodDists.reduce((s: number, d: any) => s + Number(d.amount_usd), 0);
            const date = periodDists[0]?.created_at
              ? new Date(periodDists[0].created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })
              : "N/A";
            return `- ${p}: $${periodTotal.toFixed(2)} distributed (${date})`;
          })
          .join("\n")
      : "No distributions in the last 90 days.";

    const tokenPrice = property.valuation_usd / property.total_slices;

    const userMessage = `Property Name: ${property.name}
Address: ${property.address || "N/A"}
Total Valuation: $${property.valuation_usd.toLocaleString()}
Total Investment Shares: ${property.total_slices.toLocaleString()}
Current Share Price: $${tokenPrice.toFixed(2)}
Number of Investors: ${investorCount || 0}
Total Distributed (Last 90 Days): $${totalDistributed.toFixed(2)}

Distribution History (Last 90 Days):
${distributionSummary}`;

    const systemPrompt = `You are a professional real estate investment report writer. Generate a quarterly investor update for a tokenized real estate property. The tone should be confident, transparent, and professional. Structure the update with these sections: Property Overview (1-2 sentences), Distribution Summary (what was paid and when), Performance Highlights (based on available data), and Looking Ahead (generic forward-looking statement about continued management). Keep the total update under 400 words. Do not use crypto or blockchain jargon — refer to ownership as "fractional ownership" or "investment shares." Do not fabricate any numbers. Only reference data provided.`;

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
        max_tokens: 800,
      }),
    });

    if (!aiRes.ok) {
      const errBody = await aiRes.text();
      console.error("OpenAI API error:", errBody);
      return NextResponse.json({ error: "Failed to generate update" }, { status: 500 });
    }

    const aiData = await aiRes.json();
    const update = aiData.choices?.[0]?.message?.content?.trim() || "";
    const promptTokens = aiData.usage?.prompt_tokens || 0;
    const completionTokens = aiData.usage?.completion_tokens || 0;

    // Log usage
    await supabaseAdmin.from("ai_usage_logs").insert({
      user_id: user.id,
      feature: "generate-investor-update",
      model: "gpt-4o-mini",
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
    });

    return NextResponse.json({ update });
  } catch (err) {
    console.error("Investor update error:", err);
    return NextResponse.json({ error: "Failed to generate update" }, { status: 500 });
  }
}
