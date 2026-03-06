import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyLpToken } from "@/lib/lp-auth";

/**
 * GET /api/lp/documents/download?id=docId
 *
 * Returns a signed URL for downloading a document — authenticated via LP JWT.
 * Verifies the LP has access to the property the document belongs to.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const session = verifyLpToken(token);
    if (!session) return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });

    const docId = req.nextUrl.searchParams.get("id");
    if (!docId) return NextResponse.json({ error: "Missing document id" }, { status: 400 });

    // Get the document
    const { data: doc } = await supabaseAdmin
      .from("ds_documents")
      .select("id, property_id, storage_path, label, file_name")
      .eq("id", docId)
      .single();

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // Verify the LP has access to this property through their org
    const { data: property } = await supabaseAdmin
      .from("ds_properties")
      .select("id, org_id")
      .eq("id", (doc as any).property_id)
      .single();

    if (!property || (property as any).org_id !== session.org_id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Additionally verify the LP is an investor in this property
    let hasAccess = false;

    if (session.investor_id) {
      const { data: inv } = await supabaseAdmin
        .from("ds_investors")
        .select("id")
        .eq("id", session.investor_id)
        .eq("property_id", (doc as any).property_id)
        .single();
      hasAccess = !!inv;
    } else {
      // Match by email
      const { data: inv } = await supabaseAdmin
        .from("ds_investors")
        .select("id")
        .eq("email", session.email)
        .eq("property_id", (doc as any).property_id)
        .single();
      hasAccess = !!inv;
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied — not an investor in this property" }, { status: 403 });
    }

    // Generate signed URL (1 hour)
    const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
      .from("property-documents")
      .createSignedUrl((doc as any).storage_path, 3600);

    if (urlError || !signedUrl) {
      return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
    }

    return NextResponse.json({
      url: signedUrl.signedUrl,
      fileName: (doc as any).file_name,
      label: (doc as any).label,
    });
  } catch (err) {
    console.error("LP document download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
