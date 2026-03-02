import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/** GET /api/properties — list all properties for the authenticated user */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: properties } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ properties: properties || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
