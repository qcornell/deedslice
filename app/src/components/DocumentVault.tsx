"use client";

import { useState, useRef, useCallback } from "react";
interface Session { access_token: string; [key: string]: any; }
import type { Document } from "@/types/database";

const DOC_TYPES = [
  { value: "deed", label: "📜 Deed / Title" },
  { value: "appraisal", label: "📊 Appraisal" },
  { value: "inspection", label: "🔍 Inspection Report" },
  { value: "insurance", label: "🛡️ Insurance" },
  { value: "tax", label: "💰 Tax Record" },
  { value: "contract", label: "📝 Contract / Agreement" },
  { value: "photo", label: "📷 Photo" },
  { value: "other", label: "📄 Other" },
];

interface Props {
  session: Session | null;
  propertyId: string;
  documents: Document[];
  onDocumentAdded: (doc: Document) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocIcon(type: string): string {
  const found = DOC_TYPES.find((d) => d.value === type);
  return found ? found.label.split(" ")[0] : "📄";
}

export default function DocumentVault({ session, propertyId, documents, onDocumentAdded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [docType, setDocType] = useState("deed");
  const [label, setLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!session) return;
      setError("");
      setSuccess("");
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("propertyId", propertyId);
        formData.append("documentType", docType);
        formData.append("label", label || file.name);

        const res = await fetch("/api/documents", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        setSuccess(`✓ ${label || file.name} uploaded — SHA-256 hash recorded on Hedera`);
        setLabel("");
        onDocumentAdded(data.document);
      } catch (err: any) {
        setError(err.message || "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [session, propertyId, docType, label, onDocumentAdded]
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  async function handleDownload(doc: Document) {
    if (!session) return;
    try {
      const res = await fetch(`/api/documents/download?id=${doc.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // Silent
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold">Document Vault</h2>
          <p className="text-[11px] text-ds-muted mt-0.5">
            Files are hashed (SHA-256) and recorded on Hedera — tamper-proof verification
          </p>
        </div>
        <span className="text-xs text-ds-muted">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Upload form */}
      <div className="bg-ds-bg rounded-xl p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-ds-muted mb-1 uppercase tracking-wider">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ds-accent transition"
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-ds-muted mb-1 uppercase tracking-wider">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. County Deed Record"
              className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ds-accent transition"
            />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            cursor-pointer rounded-xl border-2 border-dashed transition-all py-6
            flex flex-col items-center justify-center gap-2
            ${uploading ? "opacity-50 pointer-events-none" : ""}
            ${dragOver
              ? "border-ds-accent bg-ds-accent/5"
              : "border-ds-border hover:border-ds-accent/40"
            }
          `}
        >
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-ds-accent-text">Uploading & hashing...</span>
            </div>
          ) : (
            <>
              <span className="text-2xl">📎</span>
              <p className="text-sm font-medium">{dragOver ? "Drop file here" : "Upload document"}</p>
              <p className="text-[10px] text-ds-muted">PDF, JPEG, PNG, Word · Max 25MB</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && (
        <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-2 text-sm text-ds-red mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-ds-green/10 border border-ds-green/30 rounded-lg px-4 py-2 text-sm text-ds-green mb-4">
          {success}
        </div>
      )}

      {/* Document list */}
      {documents.length === 0 ? (
        <p className="text-sm text-ds-muted text-center py-4">No documents yet. Upload deeds, appraisals, or contracts.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between bg-ds-bg rounded-xl px-4 py-3 group hover:bg-ds-bg/80 transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-lg shrink-0">{getDocIcon(doc.document_type)}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{doc.label}</div>
                  <div className="flex items-center gap-2 text-[10px] text-ds-muted">
                    <span>{doc.file_name}</span>
                    <span>·</span>
                    <span>{formatSize(doc.file_size)}</span>
                    <span>·</span>
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {/* SHA-256 badge */}
                <span
                  className="text-[9px] font-mono text-ds-accent-text bg-ds-accent/5 px-2 py-1 rounded hidden sm:inline cursor-help"
                  title={`SHA-256: ${doc.sha256_hash}`}
                >
                  🔒 {doc.sha256_hash.slice(0, 8)}...
                </span>
                <button
                  onClick={() => handleDownload(doc)}
                  className="text-xs text-ds-accent-text hover:underline opacity-0 group-hover:opacity-100 transition"
                >
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
