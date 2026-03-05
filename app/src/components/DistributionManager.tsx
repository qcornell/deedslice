"use client";

/**
 * DistributionManager — Record income distributions to investors
 *
 * Super user-friendly:
 *   1. Enter total $ amount
 *   2. Pick period (auto-suggested) + type
 *   3. Preview proportional split before confirming
 *   4. One click → records for all investors
 *   5. Mark as paid, export CSV
 *
 * Designed so a non-technical syndicator can use this in 10 seconds.
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

// Period suggestions
function getSuggestedPeriods(): string[] {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "long" });
  const year = now.getFullYear();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  const prevQ = q === 1 ? 4 : q - 1;
  const prevQYear = q === 1 ? year - 1 : year;
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleString("en-US", { month: "long" });

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

    const allocs = investors.map(inv => ({
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
      const largest = allocs.reduce((max, a) => a.slices > max.slices ? a : max, allocs[0]);
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

      setSuccess(`✅ $${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} distributed to ${data.investorCount} investors${effectivePeriod ? ` for ${effectivePeriod}` : ""}`);
      setShowForm(false);
      setShowPreview(false);
      setTotalAmount("");
      setPeriod("");
      setNotes("");

      // Refresh
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

  // Group distributions by period for summary
  const periodSummaries = useMemo(() => {
    const groups = new Map<string, { total: number; count: number; status: string; paidCount: number }>();
    for (const d of distributions) {
      const key = d.period || "Unspecified";
      const existing = groups.get(key) || { total: 0, count: 0, status: "pending", paidCount: 0 };
      existing.total += Number(d.amount_usd);
      existing.count++;
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
  const totalPaid = distributions.filter(d => d.status === "paid").reduce((s, d) => s + Number(d.amount_usd), 0);
  const totalPending = distributions.filter(d => d.status === "pending").reduce((s, d) => s + Number(d.amount_usd), 0);

  const pieColors = ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675", "#55efc4"];

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--ds-text)" }}>Distributions</h2>
          <p className="text-[13px] mt-0.5" style={{ color: "var(--ds-muted)" }}>Record rent, income, and returns to investors</p>
        </div>
        <div className="flex items-center gap-3">
          {distributions.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-[13px] border rounded-lg px-4 py-2 transition disabled:opacity-50 hover:shadow-sm"
              style={{ color: "var(--ds-text)", borderColor: "var(--ds-border)", background: "white" }}
            >
              {exporting ? "..." : "📥 Export CSV"}
            </button>
          )}
          <button
            onClick={() => { setShowForm(!showForm); setShowPreview(false); setError(""); setSuccess(""); }}
            className="text-white font-medium px-5 py-2.5 rounded-lg text-[13px] transition-all hover:shadow-md"
            style={{ background: "#0ab4aa" }}
          >
            {showForm ? "Cancel" : "+ Record Distribution"}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-2 text-sm text-ds-red mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-ds-green/10 border border-ds-green/30 rounded-lg px-4 py-2 text-sm text-ds-green mb-4 animate-fade-in">
          {success}
        </div>
      )}

      {/* ── New Distribution Form ── */}
      {showForm && (
        <div className="bg-ds-bg rounded-xl p-5 mb-5 border border-ds-border animate-fade-in">
          <h3 className="font-semibold text-sm mb-4">New Distribution</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Total Amount */}
            <div>
              <label className="block text-[11px] text-ds-muted mb-1.5 uppercase tracking-wider font-medium">
                Total Amount (USD) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ds-muted text-sm">$</span>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={e => { setTotalAmount(e.target.value); setShowPreview(false); }}
                  min="0.01"
                  step="0.01"
                  placeholder="5,000.00"
                  className="w-full bg-white border border-ds-border rounded-lg pl-7 pr-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                />
              </div>
              <p className="text-[10px] text-ds-muted mt-1">
                Will be split proportionally across {investors.length} investor{investors.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Period */}
            <div>
              <label className="block text-[11px] text-ds-muted mb-1.5 uppercase tracking-wider font-medium">
                Period
              </label>
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                className="w-full bg-white border border-ds-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
              >
                <option value="">Select period...</option>
                {suggestedPeriods.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="__custom">Custom...</option>
              </select>
              {period === "__custom" && (
                <input
                  type="text"
                  value={customPeriod}
                  onChange={e => setCustomPeriod(e.target.value)}
                  placeholder="e.g. Jan-Mar 2026"
                  className="w-full bg-white border border-ds-border rounded-lg px-3 py-2.5 text-sm mt-2 focus:outline-none focus:border-ds-accent transition"
                />
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] text-ds-muted mb-1.5 uppercase tracking-wider font-medium">
                Type
              </label>
              <select
                value={distType}
                onChange={e => setDistType(e.target.value)}
                className="w-full bg-white border border-ds-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
              >
                <option value="distribution">Distribution (Income/Rent)</option>
                <option value="return_of_capital">Return of Capital</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] text-ds-muted mb-1.5 uppercase tracking-wider font-medium">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Monthly rental income..."
                className="w-full bg-white border border-ds-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
              />
            </div>
          </div>

          {/* Auto mark paid toggle */}
          <div className="flex items-center gap-3 mb-4">
            <input
              type="checkbox"
              checked={autoMarkPaid}
              onChange={e => setAutoMarkPaid(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0ab4aa]"
            />
            <label className="text-[12px] text-ds-text">
              Mark as paid immediately
              <span className="text-ds-muted ml-1">(skip pending step)</span>
            </label>
          </div>

          {/* Preview button */}
          {totalAmount && Number(totalAmount) > 0 && !showPreview && (
            <button
              onClick={() => setShowPreview(true)}
              className="w-full border border-ds-accent/30 text-ds-accent-text font-semibold py-2.5 rounded-[10px] text-[12px] transition-all hover:bg-ds-accent/5"
            >
              👀 Preview Split — ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} across {investors.length} investors
            </button>
          )}

          {/* ── Preview Table ── */}
          {showPreview && allocations.length > 0 && (
            <div className="mt-4 animate-fade-in">
              <div className="text-[11px] text-ds-muted uppercase tracking-wider font-medium mb-2">
                Preview: Proportional Split
              </div>
              <div className="bg-white rounded-lg border border-ds-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-ds-muted uppercase tracking-wider border-b border-ds-border">
                      <th className="text-left px-3 py-2 font-medium">Investor</th>
                      <th className="text-right px-3 py-2 font-medium">Ownership</th>
                      <th className="text-right px-3 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a, i) => (
                      <tr key={a.id} className="border-b border-ds-border/50 last:border-0">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                            <span className="font-medium">{a.name}</span>
                          </div>
                        </td>
                        <td className="text-right px-3 py-2 text-ds-muted">
                          {a.percentage}% · {a.slices.toLocaleString()} slices
                        </td>
                        <td className="text-right px-3 py-2 font-semibold text-ds-green">
                          ${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ds-border bg-ds-bg/50">
                      <td className="px-3 py-2 font-semibold text-xs">TOTAL</td>
                      <td className="text-right px-3 py-2 text-xs text-ds-muted">100%</td>
                      <td className="text-right px-3 py-2 font-bold">
                        ${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleSubmitBatch}
                disabled={submitting}
                className="w-full mt-4 text-white font-semibold py-3 rounded-[10px] text-[13px] transition-all disabled:opacity-50 hover:translate-y-[-1px]"
                style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Recording on-chain...
                  </span>
                ) : (
                  `✓ Confirm — Record $${Number(totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} Distribution`
                )}
              </button>
              <p className="text-[10px] text-ds-muted text-center mt-2">
                This will be logged to the HCS audit trail (tamper-proof) and visible in investor portals.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Summary Stats ── */}
      {distributions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(13,148,136,0.1)" }}>
                <svg width="20" height="20" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="text-[13px] font-medium" style={{ color: "var(--ds-muted)" }}>Total Distributed</div>
            <div className="text-[28px] font-bold mt-0.5" style={{ color: "var(--ds-text)" }}>${totalDistributed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(10,207,131,0.1)" }}>
                <svg width="20" height="20" fill="none" stroke="#0ACF83" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
            <div className="text-[13px] font-medium" style={{ color: "var(--ds-muted)" }}>Paid</div>
            <div className="text-[28px] font-bold mt-0.5" style={{ color: "var(--ds-text)" }}>${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,165,0,0.1)" }}>
                <svg width="20" height="20" fill="none" stroke="#FFA500" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <div className="text-[13px] font-medium" style={{ color: "var(--ds-muted)" }}>Pending</div>
            <div className="text-[28px] font-bold mt-0.5" style={{ color: "var(--ds-text)" }}>${totalPending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                <svg width="20" height="20" fill="none" stroke="#3B82F6" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <div className="text-[13px] font-medium" style={{ color: "var(--ds-muted)" }}>Distributions</div>
            <div className="text-[28px] font-bold mt-0.5" style={{ color: "var(--ds-text)" }}>{periodSummaries.length}</div>
          </div>
        </div>
      )}

      {/* ── Period Summary ── */}
      {periodSummaries.length > 0 && (
        <div className="mb-5">
          <div className="text-[11px] text-ds-muted uppercase tracking-wider font-medium mb-2">By Period</div>
          <div className="space-y-2">
            {periodSummaries.map(ps => (
              <div key={ps.period} className="bg-ds-bg rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{ps.period}</span>
                    <span className="text-[10px] text-ds-muted ml-2">{ps.count} payment{ps.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      ps.status === "paid"
                        ? "bg-ds-green/15 text-ds-green border-ds-green/30"
                        : ps.status === "partial"
                          ? "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
                          : "bg-ds-muted/15 text-ds-muted border-ds-muted/30"
                    }`}>
                      {ps.status === "paid" ? "✓ Paid" : ps.status === "partial" ? "Partial" : "Pending"}
                    </span>
                    <span className="font-semibold text-sm">
                      ${ps.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {/* Action buttons for this period */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-ds-border/50">
                  <button
                    onClick={() => handleDraftEmail(ps.period)}
                    disabled={draftingEmail && draftEmailPeriod === ps.period}
                    className="text-[10px] text-ds-muted border border-ds-border px-2 py-1 rounded-md hover:border-ds-muted transition disabled:opacity-50"
                  >
                    {draftingEmail && draftEmailPeriod === ps.period ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                        Drafting email...
                      </span>
                    ) : (
                      "Draft Investor Email"
                    )}
                  </button>
                  <button
                    onClick={() => handleGenerateNotices(ps.period)}
                    disabled={generatingNotices}
                    className="text-[10px] text-ds-muted border border-ds-border px-2 py-1 rounded-md hover:border-ds-muted transition disabled:opacity-50"
                  >
                    {generatingNotices ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </span>
                    ) : (
                      "Generate Distribution Notices"
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Draft email error */}
          {draftError && (
            <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-2 text-sm text-ds-red mt-3 animate-fade-in">
              {draftError}
            </div>
          )}

          {/* Notices error */}
          {noticesError && (
            <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-2 text-sm text-ds-red mt-3 animate-fade-in">
              {noticesError}
            </div>
          )}

          {/* Drafted email display */}
          {draftedEmail !== null && (
            <AiGeneratedContent
              content={draftedEmail}
              onChange={setDraftedEmail}
              onClose={() => setDraftedEmail(null)}
              title={draftEmailPeriod ? `Draft Email — ${draftEmailPeriod}` : "Draft Email"}
            />
          )}
        </div>
      )}

      {/* ── Individual Distribution Records ── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : distributions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-3 opacity-30">💰</div>
          <p className="text-sm text-ds-muted">No distributions recorded yet.</p>
          <p className="text-[11px] text-ds-muted/70 mt-1">
            When you collect rent or income, record it here. It auto-splits proportionally.
          </p>
        </div>
      ) : (
        <div>
          <div className="text-[11px] text-ds-muted uppercase tracking-wider font-medium mb-2">
            All Records ({distributions.length})
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {distributions.map(d => (
              <div key={d.id} className="bg-ds-bg rounded-lg px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{(d as any).investor_name || "Unknown"}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
                      d.status === "paid"
                        ? "bg-ds-green/15 text-ds-green border-ds-green/30"
                        : d.status === "failed"
                          ? "bg-ds-red/15 text-ds-red border-ds-red/30"
                          : "bg-yellow-500/15 text-yellow-500 border-yellow-500/30"
                    }`}>
                      {d.status === "paid" ? "✓ Paid" : d.status === "failed" ? "Failed" : "Pending"}
                    </span>
                  </div>
                  <span className="font-semibold text-sm text-ds-green">
                    ${Number(d.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-ds-muted">
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{(d.type || "distribution").replace(/_/g, " ")}</span>
                    {d.period && <span>· {d.period}</span>}
                    <span>· {new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                  {d.status === "pending" && (
                    <button
                      onClick={() => handleMarkPaid(d.id)}
                      disabled={markingPaid === d.id}
                      className="text-[10px] text-ds-green font-medium hover:underline disabled:opacity-50"
                    >
                      {markingPaid === d.id ? "..." : "Mark Paid"}
                    </button>
                  )}
                  {d.status === "paid" && d.paid_at && (
                    <span className="text-[10px] text-ds-green">
                      Paid {new Date(d.paid_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {d.notes && (
                  <p className="text-[10px] text-ds-muted mt-1 italic">"{d.notes}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
