import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";

/**
 * POST /api/upload-image
 * 
 * Uploads a property image to Supabase Storage.
 * Accepts multipart/form-data with:
 *   - file: the image file
 *   - propertyId: (optional) link to property immediately
 * 
 * Returns the public URL of the uploaded image.
 */

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const BUCKET = "property-images";

export async function POST(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const propertyId = formData.get("propertyId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPEG, PNG, or WebP." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Max 10MB." }, { status: 400 });
    }

    // Generate a unique path: userId/timestamp-filename
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure bucket exists (idempotent — will silently fail if already exists)
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: ALLOWED_TYPES,
    });

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: uploadError.message || "Upload failed" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;

    // If propertyId provided, update the property record
    if (propertyId) {
      // Verify ownership
      const { data: prop } = await supabaseAdmin
        .from("ds_properties")
        .select("id, owner_id")
        .eq("id", propertyId)
        .eq("owner_id", user.id)
        .single();

      if (prop) {
        await supabaseAdmin
          .from("ds_properties")
          .update({ image_url: publicUrl } as any)
          .eq("id", propertyId);
      }
    }

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      path: data.path,
    });
  } catch (err) {
    console.error("Image upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
