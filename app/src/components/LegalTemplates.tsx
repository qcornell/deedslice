"use client";

import { useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";

interface Props {
  propertyId: string;
  propertyName: string;
  session: any;
}

const TEMPLATES = [
  {
    type: "subscription",
    label: "Subscription Agreement",
    description: "Reg D 506(c) subscription agreement with investor representations and risk disclosures.",
    icon: "📝",
  },
  {
    type: "operating",
    label: "Operating Agreement",
    description: "SPV/LLC operating agreement with token structure, distribution waterfall, and transfer restrictions.",
    icon: "📋",
  },
  {
    type: "disclosure",
    label: "Investor Disclosure",
    description: "One-pager with property summary, risk factors, and how tokenization works.",
    icon: "📄",
  },
] as const;

export default function LegalTemplates({ propertyId, propertyName, session }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(templateType: string) {
    if (!session || generating) return;
    setGenerating(templateType);
    setError(null);

    try {
      const res = await fetch("/api/legal-templates", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ propertyId, templateType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate document");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const typeLabels: Record<string, string> = {
        subscription: "Subscription_Agreement",
        operating: "Operating_Agreement",
        disclosure: "Investor_Disclosure",
      };
      a.download = `DeedSlice_${typeLabels[templateType]}_${propertyName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to generate document");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xl">⚖️</span>
        <div>
          <h2 className="font-semibold" style={{ color: "#1A1F36" }}>Legal Documents</h2>
          <p className="text-xs" style={{ color: "#697386" }}>Generate legal document templates for this property</p>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-2 text-sm mb-4"
          style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)", color: "#DC2626" }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => handleGenerate(t.type)}
            disabled={generating !== null}
            className="text-left p-4 rounded-xl border transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: "#E3E8EF" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{t.icon}</span>
              <span className="text-[13px] font-semibold" style={{ color: "#1A1F36" }}>{t.label}</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "#697386" }}>
              {t.description}
            </p>
            {generating === t.type && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-3 h-3 border-2 border-[#0D9488]/30 border-t-[#0D9488] rounded-full animate-spin" />
                <span className="text-[11px] font-medium" style={{ color: "#0D9488" }}>Generating...</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
