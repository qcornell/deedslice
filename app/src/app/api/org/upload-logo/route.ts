import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUserFromToken, extractToken } from "@/lib/supabase/auth";
import { applyRateLimitAsync } from "@/lib/rate-limit";

/**
 * POST /api/org/upload-logo
 *
 * Uploads a logo/favicon image for the user's organization.
 * Accepts multipart/form-data with:
 *   - file: the image file (JPEG, PNG, WebP, SVG, ICO)
 *   - slot: "logo" | "logo_dark" | "favicon"
 *
 * Server-side:
 *   - Validates file type & size (2MB max for logos, 512KB for favicon)
 *   - Stores in Supabase Storage "org-assets" bucket
 *   - Updates ds_org_branding with the public URL
 *
 * Returns: { ok: true, url: string }
 */

const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const FAVICON_MAX_SIZE = 512 * 1024; // 512KB

const LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];
const FAVICON_TYPES = [
  "image/png",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/svg+xml",
  "image/webp",
];

const VALID_SLOTS = ["logo", "logo_dark", "favicon"] as const;
type Slot = (typeof VALID_SLOTS)[number];

const SLOT_TO_COLUMN: Record<Slot, string> = {
  logo: "logo_url",
  logo_dark: "logo_dark_url",
  favicon: "favicon_url",
};

const BUCKET = "org-assets";

export async function POST(req: NextRequest) {
  // 15 uploads per user per 10 minutes
  const blocked = await applyRateLimitAsync(req.headers, "org-logo-upload", {
    max: 15,
    windowSec: 600,
  });
  if (blocked) return blocked;

  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Must have an org
    const { data: org } = await supabaseAdmin
      .from("ds_organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!org)
      return NextResponse.json(
        { error: "No organization found. Create one first." },
        { status: 404 }
      );

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const slot = formData.get("slot") as string | null;

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });

    if (!slot || !VALID_SLOTS.includes(slot as Slot))
      return NextResponse.json(
        { error: 'Invalid slot. Use "logo", "logo_dark", or "favicon".' },
        { status: 400 }
      );

    const isFavicon = slot === "favicon";
    const allowedTypes = isFavicon ? FAVICON_TYPES : LOGO_TYPES;
    const maxSize = isFavicon ? FAVICON_MAX_SIZE : LOGO_MAX_SIZE;

    if (!allowedTypes.includes(file.type))
      return NextResponse.json(
        {
          error: isFavicon
            ? "Invalid file type. Use PNG, ICO, SVG, or WebP for favicons."
            : "Invalid file type. Use JPEG, PNG, WebP, or SVG.",
        },
        { status: 400 }
      );

    if (file.size > maxSize)
      return NextResponse.json(
        {
          error: `File too large. Max ${isFavicon ? "512KB" : "2MB"}.`,
        },
        { status: 400 }
      );

    // Build storage path: orgId/slot-timestamp.ext
    const ext =
      file.type === "image/svg+xml"
        ? "svg"
        : file.type === "image/x-icon" || file.type === "image/vnd.microsoft.icon"
        ? "ico"
        : file.name.split(".").pop() || "png";

    const orgId = (org as any).id;
    const storagePath = `${orgId}/${slot}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Delete old file for this slot if it exists in our bucket
    const column = SLOT_TO_COLUMN[slot as Slot];
    const { data: currentBranding } = await supabaseAdmin
      .from("ds_org_branding")
      .select(column)
      .eq("org_id", orgId)
      .single();

    if (currentBranding) {
      const oldUrl = (currentBranding as any)[column];
      if (oldUrl && oldUrl.includes(`/${BUCKET}/`)) {
        // Extract path from public URL
        const parts = oldUrl.split(`/${BUCKET}/`);
        if (parts[1]) {
          await supabaseAdmin.storage
            .from(BUCKET)
            .remove([parts[1]]);
        }
      }
    }

    // Upload new file
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Logo upload error:", uploadError);
      return NextResponse.json(
        { error: uploadError.message || "Upload failed" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path);

    const publicUrl = urlData.publicUrl;

    // Update branding record
    await supabaseAdmin
      .from("ds_org_branding")
      .update({
        [column]: publicUrl,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("org_id", orgId);

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    console.error("Logo upload error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org/upload-logo?slot=logo
 *
 * Remove a logo/favicon — clears the branding column and deletes from storage.
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = extractToken(req.headers.get("authorization"));
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { user, error: authError } = await getUserFromToken(token);
    if (authError || !user)
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { data: org } = await supabaseAdmin
      .from("ds_organizations")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!org)
      return NextResponse.json({ error: "No organization found" }, { status: 404 });

    const slot = req.nextUrl.searchParams.get("slot") as Slot | null;
    if (!slot || !VALID_SLOTS.includes(slot))
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });

    const column = SLOT_TO_COLUMN[slot];
    const orgId = (org as any).id;

    // Get current URL to delete from storage
    const { data: currentBranding } = await supabaseAdmin
      .from("ds_org_branding")
      .select(column)
      .eq("org_id", orgId)
      .single();

    if (currentBranding) {
      const oldUrl = (currentBranding as any)[column];
      if (oldUrl && oldUrl.includes(`/${BUCKET}/`)) {
        const parts = oldUrl.split(`/${BUCKET}/`);
        if (parts[1]) {
          await supabaseAdmin.storage.from(BUCKET).remove([parts[1]]);
        }
      }
    }

    // Clear the column
    await supabaseAdmin
      .from("ds_org_branding")
      .update({
        [column]: null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("org_id", orgId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Logo delete error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
