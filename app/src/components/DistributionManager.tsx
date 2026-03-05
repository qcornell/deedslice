"use client";

/**
 * DistributionManager — Upgraded UI (2026-03-05)
 *
 * Matches Claude mockup: stats grid (4 cards with icon circles),
 * period-grouped distribution history with table rows + avatars,
 * right sidebar action buttons. All functionality preserved:
 * record, preview split, mark paid, export CSV, AI email drafts,
 * PDF notices.
 */

import { useState, useEffect, useMemo } from "react";
import type { Property, Investor, Distribution } from "@/types/database";
import { getAuthHeaders } from "@/hooks/useAuth";
import AiGeneratedContent from "@/components/AiGeneratedContent";

interface Props {
  session: any;
  property: Property;
  investors: Investor[];
  onDistributionCreated?: () => void;
}

interface EnrichedDistribution extends Distribution {
  investor_name?: string;
  investor_email?: string | null;
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// Period suggestions
function getSuggestedPeriods(): string[] {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const prevQ = q === 1 ? 4 : q - 1;
  const prevQYear = q === 1 ? year - 1 : year;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "long" });

  return [
    `${month} ${year}`,
    `${prevMonth} ${year}`,
    `Q${prevQ} ${prevQYear}`,
    `Q${q} ${year}`,
    `H1 ${year}`,
    `H2 ${year}`,
    `${year}`,
  ];
}

export default function DistributionManager({ session, property, investors, onDistributionCreated }: Props) {
  const [distributions, setDistributions] = useState<EnrichedDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [totalAmount, setTotalAmount] = useState("");
  const [period, setPeriod] = useState("");
  const [customPeriod, setCustomPeriod] = useState("");
  const [distType, setDistType] = useState("distribution");
  const [notes, setNotes] = useState("");
  const [autoMarkPaid, setAutoMarkPaid] = useState(false);

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Mark paid state
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Exporting
  const [exporting, setExporting] = useState(false);

  // AI Draft Email state
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<string | null>(null);
  const [draftEmailPeriod, setDraftEmailPeriod] = useState<string | null>(null);
  const [draftError, setDraftError] = useState("");

  // Distribution Notices state
  const [generatingNotices, setGeneratingNotices] = useState(false);
  const [noticesError, setNoticesError] = useState("");

  const suggestedPeriods = useMemo(() => getSuggestedPeriods(), []);

  useEffect(() => {
    loadDistributions();
  }, [session, property.id]);

  async function loadDistributions() {
    if (!session) return;
    try {
      const res = await fetch(`/api/distributions?propertyId=${property.id}`, {
        headers: getAuthHeaders(session),
      });
      const data = await res.json();
      setDistributions(data.distributions || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  // Calculate preview allocations
  const allocations = useMemo(() => {
    if (!totalAmount || Number(totalAmount) <= 0 || investors.length === 0) return [];

    const total = Number(totalAmount);
    const totalSlices = investors.reduce((s, i) => s + i.slices_owned, 0);
    if (totalSlices === 0) return [];

    const allocs = investors.map((inv) => ({
      id: inv.id,
      name: inv.name,
      email: inv.email,
      slices: inv.slices_owned,
      percentage: inv.percentage,
      amount: Math.round(((inv.slices_owned / totalSlices) * total) * 100) / 100,
    }));

    // Fix rounding
    const roundedTotal = allocs.reduce((s, a) => s + a.amount, 0);
    const diff = Math.round((total - roundedTotal) * 100) / 100;
    if (diff !== 0 && allocs.length > 0) {
      const largest = allocs.reduce((max, a) => (a.slices > max.slices ? a : max), allocs[0]);
      largest.amount = Math.round((largest.amount + diff) * 100) / 100;
    }

    return allocs;
  }, [totalAmount, investors]);

  const effectivePeriod = period === "__custom" ? customPeriod : period;

  async function handleSubmitBatch() {
    if (!session || !totalAmount || Number(totalAmount) <= 0) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/distributions/batch", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          propertyId: property.id,
          totalAmount: Number(totalAmount),
          type: distType,
          period: effectivePeriod || null,
          notes: notes || null,
          autoMarkPaid,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(
        `$${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} distributed to ${data.investorCount} investors${effectivePeriod ? ` for ${effectivePeriod}` : ""}`
      );
      setShowForm(false);
      setShowPreview(false);
      setTotalAmount("");
      setPeriod("");
      setNotes("");

      loadDistributions();
      onDistributionCreated?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkPaid(distributionId: string) {
    if (!session) return;
    setMarkingPaid(distributionId);
    try {
      const res = await fetch("/api/distributions", {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ distributionId, status: "paid" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      loadDistributions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleExport() {
    if (!session) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/distributions/export?propertyId=${property.id}`, {
        headers: getAuthHeaders(session),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `distributions_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDraftEmail(periodForEmail: string) {
    if (!session) return;
    setDraftingEmail(true);
    setDraftError("");
    setDraftEmailPeriod(periodForEmail);

    try {
      const res = await fetch("/api/ai/draft-distribution-email", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          propertyId: property.id,
          distributionPeriod: periodForEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate email");

      setDraftedEmail(data.email);
    } catch (err: any) {
      setDraftError(err.message || "Could not generate email. Please try again.");
    } finally {
      setDraftingEmail(false);
    }
  }

  async function handleGenerateNotices(periodForNotices: string) {
    if (!session) return;
    setGeneratingNotices(true);
    setNoticesError("");

    try {
      const res = await fetch("/api/distributions/notices", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          propertyId: property.id,
          period: periodForNotices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate notices");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `distribution_notices_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}_${periodForNotices.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNoticesError(err.message || "Could not generate notices. Please try again.");
    } finally {
      setGeneratingNotices(false);
    }
  }

  // Group distributions by period
  const periodGroups = useMemo(() => {
    const groups = new Map<
      string,
      { total: number; count: number; status: string; paidCount: number; distributions: EnrichedDistribution[] }
    >();
    for (const d of distributions) {
      const key = d.period || "Unspecified";
      const existing = groups.get(key) || { total: 0, count: 0, status: "pending", paidCount: 0, distributions: [] };
      existing.total += Number(d.amount_usd);
      existing.count++;
      existing.distributions.push(d);
      if (d.status === "paid") existing.paidCount++;
      if (existing.paidCount === existing.count) existing.status = "paid";
      else if (existing.paidCount > 0) existing.status = "partial";
      else existing.status = "pending";
      groups.set(key, existing);
    }
    return Array.from(groups.entries()).map(([period, data]) => ({ period, ...data }));
  }, [distributions]);

  // Totals
  const totalDistributed = distributions.reduce((s, d) => s + Number(d.amount_usd), 0);
  const totalPaid = distributions.filter((d) => d.status === "paid").reduce((s, d) => s + Number(d.amount_usd), 0);
  const totalPending = distributions.filter((d) => d.status === "pending").reduce((s, d) => s + Number(d.amount_usd), 0);

  // Investor name lookup
  const investorMap = useMemo(() => {
    const m = new Map<string, Investor>();
    investors.forEach((inv) => m.set(inv.id, inv));
    return m;
  }, [investors]);

  function getInvestorIndex(investorId: string): number {
    const idx = investors.findIndex((inv) => inv.id === investorId);
    return idx >= 0 ? idx : 0;
  }

  return (
    <div>
      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 bg-[#DF1B41]/8 border border-[#DF1B41]/20 rounded-lg px-4 py-3 text-[13px] mb-4" style={{ color: "#DF1B41" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 bg-[#0ACF83]/8 border border-[#0ACF83]/20 rounded-lg px-4 py-3 text-[13px] mb-4 animate-fade-in" style={{ color: "#0ACF83" }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl p-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(13,148,136,0.1)" }}>
            <svg width="20" height="20" fill="none" stroke="#0D9488" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Total Distributed</div>
          <div className="text-[28px] font-bold mt-1 leading-none" style={{ color: "#1A1F36" }}>
            ${totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(10,207,131,0.1)" }}>
            <svg width="20" height="20" fill="none" stroke="#0ACF83" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Paid</div>
          <div className="text-[28px] font-bold mt-1 leading-none" style={{ color: "#1A1F36" }}>
            ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(255,165,0,0.1)" }}>
            <svg width="20" height="20" fill="none" stroke="#FFA500" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Pending</div>
          <div className="text-[28px] font-bold mt-1 leading-none" style={{ color: "#1A1F36" }}>
            ${totalPending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(59,130,246,0.1)" }}>
            <svg width="20" height="20" fill="none" stroke="#3B82F6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Distributions</div>
          <div className="text-[28px] font-bold mt-1 leading-none" style={{ color: "#1A1F36" }}>{periodGroups.length}</div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Main Column ── */}
        <div className="flex-1 order-2 lg:order-1">
          {/* Record Distribution Form */}
          {showForm && (
            <div className="glass rounded-xl overflow-hidden mb-6 animate-fade-in">
              <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
                <h3 className="text-[16px] font-semibold" style={{ color: "#1A1F36" }}>New Distribution</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  {/* Total Amount */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Total Amount (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "#8792A2" }}>$</span>
                      <input
                        type="number"
                        value={totalAmount}
                        onChange={(e) => { setTotalAmount(e.target.value); setShowPreview(false); }}
                        min="0.01"
                        step="0.01"
                        placeholder="5,000.00"
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg pl-7 pr-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                      />
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "#8792A2" }}>
                      Split proportionally across {investors.length} investor{investors.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Period */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Period
                    </label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="w-full bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    >
                      <option value="">Select period...</option>
                      {suggestedPeriods.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                      <option value="__custom">Custom...</option>
                    </select>
                    {period === "__custom" && (
                      <input
                        type="text"
                        value={customPeriod}
                        onChange={(e) => setCustomPeriod(e.target.value)}
                        placeholder="e.g. Jan-Mar 2026"
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] mt-2 focus:outline-none focus:border-[#0D9488] transition"
                      />
                    )}
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Type
                    </label>
                    <select
                      value={distType}
                      onChange={(e) => setDistType(e.target.value)}
                      className="w-full bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    >
                      <option value="distribution">Distribution (Income/Rent)</option>
                      <option value="return_of_capital">Return of Capital</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Monthly rental income..."
                      className="w-full bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>

                {/* Auto mark paid toggle */}
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={autoMarkPaid}
                    onChange={(e) => setAutoMarkPaid(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#0ab4aa]"
                  />
                  <label className="text-[13px]" style={{ color: "#1A1F36" }}>
                    Mark as paid immediately
                    <span className="ml-1" style={{ color: "#8792A2" }}>(skip pending step)</span>
                  </label>
                </div>

                {/* Preview button */}
                {totalAmount && Number(totalAmount) > 0 && !showPreview && (
                  <button
                    onClick={() => setShowPreview(true)}
                    className="w-full border rounded-lg py-2.5 text-[13px] font-medium transition-all hover:shadow-sm"
                    style={{ borderColor: "rgba(13,148,136,0.3)", color: "#0D9488" }}
                  >
                    Preview Split — ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} across {investors.length} investors
                  </button>
                )}

                {/* Preview Table */}
                {showPreview && allocations.length > 0 && (
                  <div className="mt-4 animate-fade-in">
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#697386" }}>
                      Proportional Split Preview
                    </div>
                    <div className="bg-white rounded-lg border overflow-hidden" style={{ borderColor: "#E3E8EF" }}>
                      {/* Table header */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b" style={{ borderColor: "#E3E8EF" }}>
                        <div className="col-span-5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Investor</div>
                        <div className="col-span-3 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: "#8792A2" }}>Ownership</div>
                        <div className="col-span-4 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: "#8792A2" }}>Amount</div>
                      </div>
                      {allocations.map((a, i) => (
                        <div key={a.id} className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-0 items-center" style={{ borderColor: "#F6F9FC" }}>
                          <div className="col-span-5 flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                              style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
                            >
                              {getInitials(a.name)}
                            </div>
                            <span className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>{a.name}</span>
                          </div>
                          <div className="col-span-3 text-right text-[13px]" style={{ color: "#697386" }}>
                            {a.percentage}%
                          </div>
                          <div className="col-span-4 text-right text-[14px] font-semibold" style={{ color: "#0ACF83" }}>
                            ${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      ))}
                      {/* Total row */}
                      <div className="grid grid-cols-12 gap-4 px-4 py-3 border-t" style={{ borderColor: "#E3E8EF", background: "#F6F9FC" }}>
                        <div className="col-span-5 text-[12px] font-semibold" style={{ color: "#1A1F36" }}>TOTAL</div>
                        <div className="col-span-3 text-right text-[12px]" style={{ color: "#697386" }}>100%</div>
                        <div className="col-span-4 text-right text-[14px] font-bold" style={{ color: "#1A1F36" }}>
                          ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Confirm button */}
                    <button
                      onClick={handleSubmitBatch}
                      disabled={submitting}
                      className="w-full mt-4 inline-flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg text-[14px] transition-all disabled:opacity-50 hover:shadow-md"
                      style={{ background: "#0ab4aa" }}
                    >
                      {submitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Recording on-chain...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Confirm — Record ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} Distribution
                        </>
                      )}
                    </button>
                    <div className="flex items-start gap-2 rounded-lg p-3 mt-3" style={{ background: "rgba(10,180,170,0.04)", border: "1px solid rgba(10,180,170,0.12)" }}>
                      <svg width="14" height="14" fill="none" stroke="#0ab4aa" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#697386" }}>
                        This will be logged to the HCS audit trail (tamper-proof) and visible in investor portals.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Distribution History ── */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Distribution History</h2>
              {distributions.length > 0 && (
                <span className="text-[13px] font-medium" style={{ color: "#697386" }}>
                  {periodGroups.length} period{periodGroups.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : distributions.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(135,146,162,0.08)" }}>
                    <svg width="24" height="24" fill="none" stroke="#8792A2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-medium" style={{ color: "#697386" }}>No distributions recorded yet</p>
                  <p className="text-[13px] mt-1" style={{ color: "#8792A2" }}>
                    When you collect rent or income, record it here. It auto-splits proportionally.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {periodGroups.map((pg) => (
                    <div key={pg.period}>
                      {/* Period header */}
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-3" style={{ background: pg.status === "paid" ? "rgba(10,207,131,0.06)" : "rgba(255,165,0,0.06)" }}>
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                          style={{ background: pg.status === "paid" ? "#0ACF83" : "#FFA500" }}
                        >
                          <svg width="12" height="12" fill="none" stroke="white" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[15px] font-semibold" style={{ color: "#1A1F36" }}>{pg.period}</span>
                        <span className="text-[15px] font-semibold" style={{ color: "#1A1F36" }}>
                          ${pg.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[13px]" style={{ color: "#697386" }}>distributed</span>
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ml-auto"
                          style={{
                            background: pg.status === "paid" ? "rgba(10,207,131,0.1)" : pg.status === "partial" ? "rgba(255,165,0,0.1)" : "rgba(135,146,162,0.1)",
                            color: pg.status === "paid" ? "#0ACF83" : pg.status === "partial" ? "#FFA500" : "#8792A2",
                          }}
                        >
                          {pg.status === "paid" ? "Paid" : pg.status === "partial" ? "Partial" : "Pending"}
                        </span>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        {/* Column headers */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 pb-2 border-b" style={{ borderColor: "#E3E8EF" }}>
                          <div className="col-span-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Investor</div>
                          <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Ownership</div>
                          <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Status</div>
                          <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: "#8792A2" }}>Amount</div>
                          <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: "#8792A2" }}>Date</div>
                        </div>

                        <div className="divide-y" style={{ borderColor: "#F6F9FC" }}>
                          {pg.distributions.map((d) => {
                            const inv = investorMap.get(d.investor_id);
                            const invName = (d as any).investor_name || inv?.name || "Unknown";
                            const invIdx = getInvestorIndex(d.investor_id);

                            return (
                              <div key={d.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-4 py-3 items-center">
                                {/* Investor */}
                                <div className="col-span-4 flex items-center gap-3">
                                  <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                                    style={{ background: AVATAR_GRADIENTS[invIdx % AVATAR_GRADIENTS.length] }}
                                  >
                                    {getInitials(invName)}
                                  </div>
                                  <span className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>{invName}</span>
                                </div>

                                {/* Ownership */}
                                <div className="col-span-2 text-[14px]" style={{ color: "#1A1F36" }}>
                                  {inv ? `${inv.percentage}%` : "—"}
                                </div>

                                {/* Status */}
                                <div className="col-span-2 flex items-center gap-2">
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                    style={{
                                      background: d.status === "paid" ? "rgba(10,207,131,0.1)" : d.status === "failed" ? "rgba(223,27,65,0.1)" : "rgba(255,165,0,0.1)",
                                      color: d.status === "paid" ? "#0ACF83" : d.status === "failed" ? "#DF1B41" : "#FFA500",
                                    }}
                                  >
                                    {d.status === "paid" && (
                                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    )}
                                    {d.status === "paid" ? "Paid" : d.status === "failed" ? "Failed" : "Pending"}
                                  </span>
                                  {d.status === "pending" && (
                                    <button
                                      onClick={() => handleMarkPaid(d.id)}
                                      disabled={markingPaid === d.id}
                                      className="text-[11px] font-medium hover:underline disabled:opacity-50"
                                      style={{ color: "#0ACF83" }}
                                    >
                                      {markingPaid === d.id ? "..." : "Mark Paid"}
                                    </button>
                                  )}
                                </div>

                                {/* Amount */}
                                <div className="col-span-2 text-right text-[14px] font-semibold" style={{ color: "#1A1F36" }}>
                                  ${Number(d.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>

                                {/* Date */}
                                <div className="col-span-2 text-right text-[13px]" style={{ color: "#697386" }}>
                                  {d.paid_at
                                    ? new Date(d.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Period action buttons */}
                      <div className="flex items-center gap-2 mt-3 px-4">
                        <button
                          onClick={() => handleDraftEmail(pg.period)}
                          disabled={draftingEmail && draftEmailPeriod === pg.period}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium border rounded-lg px-3 py-1.5 transition-all hover:shadow-sm disabled:opacity-50"
                          style={{ color: "#697386", borderColor: "#E3E8EF" }}
                        >
                          {draftingEmail && draftEmailPeriod === pg.period ? (
                            <>
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              Drafting...
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Draft Email
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleGenerateNotices(pg.period)}
                          disabled={generatingNotices}
                          className="inline-flex items-center gap-1.5 text-[12px] font-medium border rounded-lg px-3 py-1.5 transition-all hover:shadow-sm disabled:opacity-50"
                          style={{ color: "#697386", borderColor: "#E3E8EF" }}
                        >
                          {generatingNotices ? (
                            <>
                              <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              PDF Notices
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Draft email errors/display */}
              {draftError && (
                <div className="flex items-center gap-2 bg-[#DF1B41]/8 border border-[#DF1B41]/20 rounded-lg px-4 py-3 text-[13px] mt-4" style={{ color: "#DF1B41" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {draftError}
                </div>
              )}
              {noticesError && (
                <div className="flex items-center gap-2 bg-[#DF1B41]/8 border border-[#DF1B41]/20 rounded-lg px-4 py-3 text-[13px] mt-4" style={{ color: "#DF1B41" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {noticesError}
                </div>
              )}
              {draftedEmail !== null && (
                <AiGeneratedContent
                  content={draftedEmail}
                  onChange={setDraftedEmail}
                  onClose={() => setDraftedEmail(null)}
                  title={draftEmailPeriod ? `Draft Email — ${draftEmailPeriod}` : "Draft Email"}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar: Actions ── */}
        <div className="w-full lg:w-[280px] flex-shrink-0 order-1 lg:order-2">
          <div className="space-y-3">
            {/* Record Distribution — primary */}
            <button
              onClick={() => { setShowForm(!showForm); setShowPreview(false); setError(""); setSuccess(""); }}
              className="w-full inline-flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg text-[14px] transition-all hover:shadow-md"
              style={{ background: "#0ab4aa" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {showForm ? "Cancel" : "Record Distribution"}
            </button>

            {/* Export CSV */}
            {distributions.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full inline-flex items-center gap-3 px-4 py-3 rounded-lg border bg-white text-[14px] font-medium transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] disabled:opacity-50"
                style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}
              >
                <svg width="18" height="18" fill="none" stroke="#697386" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                {exporting ? "Exporting..." : "Download CSV"}
              </button>
            )}

            {/* Quick links */}
            <div className="glass rounded-xl p-5 mt-2">
              <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#1A1F36" }}>Quick Links</h3>
              <div className="space-y-2">
                <a
                  href={`/dashboard/investors`}
                  className="flex items-center gap-3 text-[13px] font-medium py-2 transition hover:opacity-70"
                  style={{ color: "#697386" }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Manage Investors
                </a>
                <a
                  href={`/dashboard/audit`}
                  className="flex items-center gap-3 text-[13px] font-medium py-2 transition hover:opacity-70"
                  style={{ color: "#697386" }}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Audit Trail
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
