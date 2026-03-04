"use client";

import { useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";
import AiGeneratedContent from "@/components/AiGeneratedContent";

interface Props {
  session: any;
  propertyId: string;
  propertyName: string;
}

export default function InvestorUpdate({ session, propertyId, propertyName }: Props) {
  const [loading, setLoading] = useState(false);
  const [update, setUpdate] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleGenerate() {
    if (!session) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/ai/generate-investor-update", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ propertyId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate update");

      setUpdate(data.update);
    } catch (err: any) {
      setError(err.message || "Could not generate update. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="text-[11px] font-medium border px-3 py-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
        style={{
          borderColor: "var(--ds-border)",
          color: "var(--ds-text)",
        }}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Generating update...
          </span>
        ) : (
          "Generate Quarterly Update"
        )}
      </button>

      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {update !== null && (
        <AiGeneratedContent
          content={update}
          onChange={setUpdate}
          onClose={() => setUpdate(null)}
          showDownloadPdf
          title={`Quarterly Update — ${propertyName}`}
        />
      )}
    </div>
  );
}
