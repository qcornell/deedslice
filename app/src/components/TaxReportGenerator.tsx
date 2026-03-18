"use client";

import { useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";

interface Props {
  properties: Array<{ id: string; name: string }>;
  session: any;
}

export default function TaxReportGenerator({ properties, session }: Props) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [propertyId, setPropertyId] = useState("");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!session || generating) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/tax-reports", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          year,
          propertyId: propertyId || undefined,
          format,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate report");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DeedSlice_Tax_Report_${year}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xl">📊</span>
        <div>
          <h2 className="font-semibold" style={{ color: "#1A1F36" }}>Tax Reports</h2>
          <p className="text-xs" style={{ color: "#697386" }}>Generate distribution reports for tax filing</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Year Selector */}
        <div>
          <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#697386" }}>
            Year
          </label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full bg-white border rounded-lg px-3 py-2.5 text-[14px] font-medium focus:outline-none focus:border-[#0D9488] transition"
            style={{ borderColor: "#E3E8EF" }}
          >
            <option value={currentYear}>{currentYear}</option>
            <option value={currentYear - 1}>{currentYear - 1}</option>
          </select>
        </div>

        {/* Property Filter */}
        <div>
          <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#697386" }}>
            Property
          </label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full bg-white border rounded-lg px-3 py-2.5 text-[14px] font-medium focus:outline-none focus:border-[#0D9488] transition"
            style={{ borderColor: "#E3E8EF" }}
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Format Toggle */}
        <div>
          <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "#697386" }}>
            Format
          </label>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: "#E3E8EF" }}>
            <button
              onClick={() => setFormat("pdf")}
              className="flex-1 py-2.5 text-[13px] font-medium transition-all"
              style={{
                background: format === "pdf" ? "#0D9488" : "white",
                color: format === "pdf" ? "white" : "#697386",
              }}
            >
              📄 PDF
            </button>
            <button
              onClick={() => setFormat("csv")}
              className="flex-1 py-2.5 text-[13px] font-medium transition-all"
              style={{
                background: format === "csv" ? "#0D9488" : "white",
                color: format === "csv" ? "white" : "#697386",
                borderLeft: "1px solid #E3E8EF",
              }}
            >
              📋 CSV
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-2 text-white font-semibold px-6 py-2.5 rounded-lg text-[13px] transition-all disabled:opacity-50 hover:translate-y-[-1px]"
        style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
      >
        {generating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Generating...
          </>
        ) : (
          <>Generate Report</>
        )}
      </button>
    </div>
  );
}
