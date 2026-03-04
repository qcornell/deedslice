import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/email";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit: 5 signups per IP per 15 minutes
  const blocked = applyRateLimit(req.headers, "signup", { max: 5, windowSec: 900 });
  if (blocked) return blocked;

  try {
    const { email, password, fullName, companyName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Signup failed" }, { status: 400 });
    }

    await supabaseAdmin.from("ds_profiles").insert({
      id: authData.user.id,
      email,
      full_name: fullName || null,
      company_name: companyName || null,
      plan: "starter",
      properties_used: 0,
      properties_limit: 1,
    } as any);

    const { data: signIn } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    // Send welcome email (fire and forget)
    sendWelcomeEmail(email, fullName || undefined).catch((err) =>
      console.error("Welcome email failed:", err)
    );

    return NextResponse.json({
      ok: true,
      user: { id: authData.user.id, email },
      session: signIn.session,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
