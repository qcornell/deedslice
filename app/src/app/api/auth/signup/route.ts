import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
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

    return NextResponse.json({
      ok: true,
      user: { id: authData.user.id, email },
      session: signIn.session,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
