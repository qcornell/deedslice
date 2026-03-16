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

    // First try admin.createUser (fast, pre-confirmed).
    // If that fails due to a DB trigger issue, fall back to client-side signUp.
    let userId: string | null = null;
    let useAdminFlow = true;

    const { data: authData, error: authError } = await (supabaseAdmin as any).auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6),
      },
    });

    if (authError || !authData?.user) {
      // If it's "already registered", return immediately
      if (authError?.message?.includes("already registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }
      if (authError?.message?.includes("password")) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      // DB trigger error — fall back to client-side signUp
      useAdminFlow = false;
      const { data: signUpData, error: signUpError } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: email.split("@")[0] + "_" + Math.random().toString(36).slice(2, 6),
          },
        },
      });

      if (signUpError || !signUpData?.user) {
        const msg = signUpError?.message?.includes("already registered")
          ? "An account with this email already exists."
          : signUpError?.message?.includes("password")
          ? "Password must be at least 6 characters."
          : "Signup failed. Please try again.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      userId = signUpData.user.id;

      // Auto-confirm via admin if possible (ignore errors — user may need email confirm)
      await (supabaseAdmin as any).auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => {});
    } else {
      userId = authData.user.id;
    }

    // Create DeedSlice profile (upsert to avoid conflicts with any trigger)
    await supabaseAdmin.from("ds_profiles").upsert({
      id: userId,
      email,
      full_name: fullName || null,
      company_name: companyName || null,
      plan: "starter",
      properties_used: 0,
      properties_limit: 999,
      tokenization_credits: 0,
    } as any, { onConflict: "id" });

    const { data: signIn } = await (supabaseAuth as any).auth.signInWithPassword({ email, password });

    // Send welcome email (fire and forget)
    sendWelcomeEmail(email, fullName || undefined).catch((err) =>
      console.error("Welcome email failed:", err)
    );

    return NextResponse.json({
      ok: true,
      user: { id: userId, email },
      session: signIn?.session || null,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
