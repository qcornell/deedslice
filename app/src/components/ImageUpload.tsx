"use client";

import { useState, useRef, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";

interface Props {
  session: Session | null;
  propertyId?: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  className?: string;
}

export default function ImageUpload({
  session,
  propertyId,
  currentUrl,
  onUploaded,
  className = "",
}: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!session) return;
      setError("");

      // Validate client-side
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/avif"];
      if (!allowed.includes(file.type)) {
        setError("Use JPEG, PNG, or WebP images.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        return;
      }

      // Show instant preview
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        if (propertyId) formData.append("propertyId", propertyId);

        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setPreview(data.url);
        onUploaded(data.url);
      } catch (err: any) {
        setError(err.message || "Upload failed");
        setPreview(currentUrl || null);
      } finally {
        setUploading(false);
        URL.revokeObjectURL(localUrl);
      }
    },
    [session, propertyId, currentUrl, onUploaded]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className={className}>
      {preview ? (
        /* Image preview with replace overlay */
        <div className="relative group rounded-xl overflow-hidden">
          <img
            src={preview}
            alt="Property"
            className="w-full h-48 object-cover rounded-xl"
          />
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-xs font-medium">Uploading...</span>
              </div>
            </div>
          )}
          {!uploading && (
            <div
              className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center cursor-pointer rounded-xl"
              onClick={() => inputRef.current?.click()}
            >
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-lg">
                📷 Replace Image
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Drop zone */
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed transition-all h-48
            flex flex-col items-center justify-center gap-3
            ${dragOver
              ? "border-ds-accent bg-ds-accent/5 scale-[1.01]"
              : "border-ds-border hover:border-ds-accent/40 hover:bg-ds-bg"
            }
          `}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-ds-accent-text font-medium">Uploading...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(13,148,136,0.06)", border: "1px solid rgba(13,148,136,0.1)" }}>
                📷
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-ds-text">
                  {dragOver ? "Drop image here" : "Upload property photo"}
                </p>
                <p className="text-[11px] text-ds-muted mt-0.5">
                  Drag & drop or click · JPEG, PNG, WebP · Max 10MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-ds-red mt-1.5">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
