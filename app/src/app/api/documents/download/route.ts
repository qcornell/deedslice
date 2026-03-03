import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/**
 * GET /api/documents/download?id=docId
 * Returns a signed URL for downloading a private document
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const docId = req.nextUrl.searchParams.get("id");
    if (!docId) return NextResponse.json({ error: "Missing document id" }, { status: 400 });

    // Get document record
    const { data: doc } = await supabaseAdmin
      .from("ds_documents")
      .select("*, ds_properties!inner(owner_id)")
      .eq("id", docId)
      .single();

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Verify ownership through the property
    if ((doc as any).ds_properties?.owner_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
      .from("property-documents")
      .createSignedUrl((doc as any).storage_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
    }

    return NextResponse.json({ url: signedUrl.signedUrl });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
