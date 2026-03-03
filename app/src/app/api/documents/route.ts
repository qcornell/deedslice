import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { logAuditEntry } from "@/lib/hedera/engine";
import { createHash } from "crypto";
import type { Property } from "@/types/database";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const BUCKET = "property-documents";

/**
 * POST /api/documents — Upload a document for a property
 * Stores file in Supabase Storage, logs SHA-256 hash to HCS audit trail
 */
export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string | null;
    const documentType = formData.get("documentType") as string || "other";
    const label = formData.get("label") as string || file?.name || "Untitled";

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use PDF, JPEG, PNG, WebP, or Word." }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 25MB." }, { status: 400 });
    }

    // Verify property ownership
    const { data: propData } = await supabaseAdmin
      .from("ds_properties")
      .select("*")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    const property = propData as Property | null;
    if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // SHA-256 hash of file contents — this goes on-chain
    const sha256 = createHash("sha256").update(buffer).digest("hex");

    // Upload to Supabase Storage
    const ext = file.name.split(".").pop() || "pdf";
    const storagePath = `${user.id}/${propertyId}/${Date.now()}-${sha256.slice(0, 8)}.${ext}`;

    // Ensure bucket exists
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: false, // Documents are private — accessed via signed URLs
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Document upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 });
    }

    // Store document record in DB
    const { data: doc, error: docError } = await supabaseAdmin
      .from("ds_documents")
      .insert({
        property_id: propertyId,
        uploaded_by: user.id,
        label,
        document_type: documentType,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_path: uploadData.path,
        sha256_hash: sha256,
      })
      .select()
      .single();

    if (docError) {
      console.error("Document DB error:", docError);
      return NextResponse.json({ error: "Failed to save document record" }, { status: 500 });
    }

    // Log to HCS audit trail — the hash is now permanently on Hedera
    if (property.audit_topic_id) {
      await logAuditEntry(property.audit_topic_id, "DOCUMENT_ADDED", {
        documentId: (doc as any).id,
        label,
        documentType,
        fileName: file.name,
        fileSize: file.size,
        sha256: sha256,
        note: "File hash recorded on Hedera — verify integrity by comparing SHA-256",
      });
    }

    // Log to DB audit entries
    await supabaseAdmin.from("ds_audit_entries").insert({
      property_id: propertyId,
      action: "DOCUMENT_ADDED",
      details: `${label} (${documentType}) — SHA-256: ${sha256.slice(0, 16)}...`,
      tx_id: null, // HCS topic message, not a direct tx
    });

    return NextResponse.json({
      ok: true,
      document: doc,
      sha256,
    });
  } catch (err) {
    console.error("Document upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/documents?propertyId=xxx — List documents for a property
 */
export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) return NextResponse.json({ error: "Missing propertyId" }, { status: 400 });

    // Verify ownership
    const { data: prop } = await supabaseAdmin
      .from("ds_properties")
      .select("id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .single();

    if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });

    const { data: documents } = await supabaseAdmin
      .from("ds_documents")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });

    return NextResponse.json({ documents: documents || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
