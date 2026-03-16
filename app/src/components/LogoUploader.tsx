"use client";

/**
 * LogoUploader — Drag-and-drop logo/favicon uploader with client-side resize & preview.
 *
 * Features:
 * - Drag & drop or click to browse
 * - Client-side resize (canvas API) before upload to keep files small
 * - Live preview of current logo
 * - Recommended dimensions shown
 * - Delete button to remove
 * - Falls back to URL input for advanced users
 */

import { useCallback, useRef, useState } from "react";

type Slot = "logo" | "logo_dark" | "favicon";

interface LogoUploaderProps {
  slot: Slot;
  label: string;
  hint: string;
  currentUrl: string | null;
  session: any;
  onUploaded: (url: string | null) => void;
  /** Max width in px for client-side resize */
  maxWidth?: number;
  /** Max height in px for client-side resize */
  maxHeight?: number;
  /** Preview background color (to show contrast) */
  previewBg?: string;
}

const SLOT_CONFIG: Record<
  Slot,
  {
    accept: string;
    maxSizeLabel: string;
    recommendedLabel: string;
  }
> = {
  logo: {
    accept: "image/jpeg,image/png,image/webp,image/svg+xml",
    maxSizeLabel: "2MB",
    recommendedLabel: "400×80px, transparent PNG or SVG",
  },
  logo_dark: {
    accept: "image/jpeg,image/png,image/webp,image/svg+xml",
    maxSizeLabel: "2MB",
    recommendedLabel: "400×80px, white/light logo on transparent",
  },
  favicon: {
    accept: "image/png,image/x-icon,image/svg+xml,image/webp",
    maxSizeLabel: "512KB",
    recommendedLabel: "64×64px square, PNG or ICO",
  },
};

/**
 * Resize an image file client-side using Canvas.
 * Returns a Blob ready for upload (preserves aspect ratio).
 * SVGs and ICOs pass through unchanged.
 */
async function resizeImage(
  file: File,
  maxW: number,
  maxH: number
): Promise<Blob> {
  // Don't resize SVG or ICO
  if (
    file.type === "image/svg+xml" ||
    file.type === "image/x-icon" ||
    file.type === "image/vnd.microsoft.icon"
  ) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Only downscale, never upscale
      if (width <= maxW && height <= maxH) {
        resolve(file);
        return;
      }

      const ratio = Math.min(maxW / width, maxH / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/png",
        0.92
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for resize"));
    };

    img.src = url;
  });
}

export default function LogoUploader({
  slot,
  label,
  hint,
  currentUrl,
  session,
  onUploaded,
  maxWidth = 800,
  maxHeight = 200,
  previewBg,
}: LogoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const config = SLOT_CONFIG[slot];

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);

      try {
        // Client-side resize
        const resized = await resizeImage(
          file,
          slot === "favicon" ? 128 : maxWidth,
          slot === "favicon" ? 128 : maxHeight
        );

        const formData = new FormData();
        formData.append("file", resized, file.name);
        formData.append("slot", slot);

        const res = await fetch("/api/org/upload-logo", {
          method: "POST",
          headers: session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {},
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        onUploaded(data.url);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [slot, session, onUploaded, maxWidth, maxHeight]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/org/upload-logo?slot=${slot}`, {
        method: "DELETE",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      onUploaded(null);
    } catch (err: any) {
      setError(err.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [slot, session, onUploaded]);

  const handleManualUrl = useCallback(() => {
    if (manualUrl.trim()) {
      onUploaded(manualUrl.trim());
      setManualUrl("");
      setShowUrlInput(false);
    }
  }, [manualUrl, onUploaded]);

  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1.5 text-ds-muted tracking-wide uppercase">
        {label}
      </label>

      {currentUrl ? (
        /* ── Has logo: show preview + actions ── */
        <div className="flex items-center gap-3">
          <div
            className="relative w-[160px] h-[56px] rounded-lg border border-ds-border flex items-center justify-center overflow-hidden shrink-0"
            style={{
              background: previewBg || (slot === "logo_dark" ? "#1E293B" : "#F8FAFC"),
            }}
          >
            <img
              src={currentUrl}
              alt={label}
              className={
                slot === "favicon"
                  ? "w-8 h-8 object-contain"
                  : "max-w-[140px] max-h-[44px] object-contain"
              }
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-ds-border transition-all hover:border-ds-accent disabled:opacity-50"
              style={{ color: "#0D9488" }}
            >
              {uploading ? "Uploading..." : "Replace"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ color: "#EF4444" }}
            >
              {deleting ? "..." : "Remove"}
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={config.accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        /* ── No logo: show drop zone ── */
        <div
          className={`relative border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-[#0D9488] bg-[#0D9488]/5"
              : "border-ds-border hover:border-[#0D9488]/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
              <span className="text-[12px] text-ds-muted">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="text-2xl mb-1 opacity-40">
                {slot === "favicon" ? "🔷" : "🖼"}
              </div>
              <p className="text-[12px] font-medium text-ds-text-secondary">
                Drop {slot === "favicon" ? "favicon" : "logo"} here or{" "}
                <span style={{ color: "#0D9488" }}>browse</span>
              </p>
              <p className="text-[10px] text-ds-muted mt-1">
                {config.recommendedLabel} · Max {config.maxSizeLabel}
              </p>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={config.accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-[11px] text-ds-red mt-1.5 px-1">{error}</div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-[10px] text-ds-muted mt-1">{hint}</p>
      )}

      {/* Advanced: manual URL */}
      <div className="mt-1.5">
        {!showUrlInput ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowUrlInput(true);
            }}
            className="text-[10px] text-ds-muted hover:text-ds-text-secondary transition-colors"
          >
            Or paste a URL →
          </button>
        ) : (
          <div className="flex items-center gap-1.5 mt-1">
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://yoursite.com/logo.png"
              className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none focus:border-ds-accent transition"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualUrl();
              }}
            />
            <button
              onClick={handleManualUrl}
              className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg text-white"
              style={{ background: "#0ab4aa" }}
            >
              Set
            </button>
            <button
              onClick={() => {
                setShowUrlInput(false);
                setManualUrl("");
              }}
              className="text-[10px] text-ds-muted px-1.5 py-1.5"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
