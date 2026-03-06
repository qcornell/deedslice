import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import { applyRateLimitAsync } from "@/lib/rate-limit";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  // Rate limit: 5 signups per IP per 15 minutes
  const blocked = await applyRateLimitAsync(req.headers, "signup", { max: 5, windowSec: 900 });
  if (blocked) return blocked;

  try {
    const { email, password, fullName, companyName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const { data: authData, error: authError } = await (supabaseAdmin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      // Sanitize Supabase error messages
      const safeMsg = authError?.message?.includes("already registered")
        ? "An account with this email already exists."
        : authError?.message?.includes("password")
        ? "Password must be at least 6 characters."
        : "Signup failed. Please try again.";
      return NextResponse.json({ error: safeMsg }, { status: 400 });
    }

    await supabaseAdmin.from("ds_profiles").insert({
      id: authData.user.id,
      email,
      full_name: fullName || null,
      company_name: companyName || null,
      plan: "starter",
      properties_used: 0,
      properties_limit: 999,
      tokenization_credits: 0,
    } as any);

    const { data: signIn } = await (supabaseAuth as any).auth.signInWithPassword({ email, password });

    // Send welcome email (fire and forget)
    sendWelcomeEmail(email, fullName || undefined).catch((err) =>
      console.error("Welcome email failed:", err)
    );

    return NextResponse.json({
      ok: true,
      user: { id: authData.user.id, email },
      session: signIn?.session || null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
