"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
import type { Property, Investor } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════
 *  Investors Page — Upgraded UI (2026-03-05)
 *  Portfolio overview donut · Avatar initials · Dollar values
 *  Property selector w/ View Property · Table-style headers
 *  All existing functionality preserved: KYC, wallet edit,
 *  transfers, Transfer All, allocation summary
 * ═══════════════════════════════════════════════════════════════ */

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)",
];

const PIE_COLORS = ["#0ab4aa", "#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675"];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ── SVG Donut Chart (no dependencies) ── */
function DonutChart({ slices, colors }: { slices: { label: string; value: number }[]; colors: string[] }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) return null;

  const radius = 70;
  const cx = 90;
  const cy = 90;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = slices.map((sl, i) => {
    const pct = sl.value / total;
    const dashLength = pct * circumference;
    const dashOffset = -offset;
    offset += dashLength;
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={colors[i % colors.length]}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
      />
    );
  });

  // Remaining unallocated
  const allocated = slices.reduce((s, sl) => s + sl.value, 0);
  if (allocated < 100) {
    const remaining = 100 - allocated;
    const pct = remaining / total * (total / 100); // normalize
    // Actually let's compute from percentage
  }

  return (
    <svg viewBox="0 0 180 180" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#E3E8EF" strokeWidth={strokeWidth} />
      {segments}
    </svg>
  );
}

export default function InvestorsPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add investor form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [slices, setSlices] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Transfer state
  const [transferring, setTransferring] = useState<string | null>(null);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState("");

  // Edit wallet state
  const [editingWallet, setEditingWallet] = useState<string | null>(null);
  const [editWalletValue, setEditWalletValue] = useState("");

  // KYC state
  const [updatingKyc, setUpdatingKyc] = useState<string | null>(null);

  // Load properties
  useEffect(() => {
    if (!session) return;
    fetch("/api/properties", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        const props = (d.properties || []).filter((p: Property) => p.status === "live");
        setProperties(props);
        if (props.length > 0) setSelectedProperty(props[0].id);
        setLoading(false);
      });
  }, [session]);

  // Load investors when property changes
  useEffect(() => {
    if (!session || !selectedProperty) return;
    fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setInvestors(d.investors || []));
  }, [session, selectedProperty]);

  const currentProperty = properties.find((p) => p.id === selectedProperty);

  // Computed values
  const totalAllocated = useMemo(() => investors.reduce((s, i) => s + i.slices_owned, 0), [investors]);
  const totalPct = useMemo(() => investors.reduce((s, i) => s + i.percentage, 0), [investors]);
  const pricePerSlice = currentProperty ? currentProperty.valuation_usd / currentProperty.total_slices : 0;

  // Donut data
  const donutSlices = useMemo(() => {
    const inv = investors.map((i) => ({ label: i.name, value: i.percentage }));
    if (currentProperty) {
      const remaining = 100 - totalPct;
      if (remaining > 0) inv.push({ label: "Unallocated", value: remaining });
    }
    return inv;
  }, [investors, currentProperty, totalPct]);

  const donutColors = useMemo(() => {
    const c = investors.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]);
    if (currentProperty && 100 - totalPct > 0) c.push("#E3E8EF");
    return c;
  }, [investors, currentProperty, totalPct]);

  async function handleAddInvestor(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedProperty) return;
    setError("");
    setSuccess("");
    setAdding(true);

    try {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          propertyId: selectedProperty,
          name,
          email: email || undefined,
          walletAddress: walletAddress || undefined,
          slicesOwned: Number(slices),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(`Added ${name} with ${slices} slices`);
      setName("");
      setEmail("");
      setWalletAddress("");
      setSlices("");

      // Refresh investors
      const refreshRes = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) });
      const refreshData = await refreshRes.json();
      setInvestors(refreshData.investors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  // Transfer tokens to investor
  async function handleTransfer(investorId: string, investorName: string) {
    if (!session) return;
    setTransferError("");
    setTransferSuccess("");
    setTransferring(investorId);

    try {
      const res = await fetch("/api/investors/transfer", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ investorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setTransferSuccess(`Transferred slices to ${investorName}! TX: ${data.txId}`);

      // Refresh investors
      const refreshRes = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) });
      const refreshData = await refreshRes.json();
      setInvestors(refreshData.investors || []);
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setTransferring(null);
    }
  }

  // Save wallet address for investor
  async function handleSaveWallet(investorId: string) {
    if (!session) return;
    setTransferError("");

    try {
      const res = await fetch("/api/investors/update", {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ investorId, walletAddress: editWalletValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEditingWallet(null);
      setEditWalletValue("");

      // Refresh investors
      const refreshRes = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) });
      const refreshData = await refreshRes.json();
      setInvestors(refreshData.investors || []);
    } catch (err: any) {
      setTransferError(err.message);
    }
  }

  async function handleKycUpdate(investorId: string, status: string) {
    if (!session) return;
    setUpdatingKyc(investorId);
    setTransferError("");
    try {
      const res = await fetch("/api/investors/kyc", {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ investorId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Refresh investors
      const rr = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) });
      const rd = await rr.json();
      setInvestors(rd.investors || []);
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setUpdatingKyc(null);
    }
  }

  function getKycBadge(inv: Investor) {
    const status = inv.kyc_status || "unverified";
    const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
      unverified: { bg: "bg-[#8792A2]/10", text: "text-[#8792A2]", border: "border-[#8792A2]/20", label: "Unverified" },
      pending: { bg: "bg-[#FFA500]/10", text: "text-[#FFA500]", border: "border-[#FFA500]/20", label: "KYC Pending" },
      verified: { bg: "bg-[#0ACF83]/10", text: "text-[#0ACF83]", border: "border-[#0ACF83]/20", label: "KYC Verified" },
      rejected: { bg: "bg-[#DF1B41]/10", text: "text-[#DF1B41]", border: "border-[#DF1B41]/20", label: "KYC Rejected" },
    };
    const s = styles[status] || styles.unverified;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text} border ${s.border}`}>
        {status === "verified" && (
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
        )}
        {s.label}
      </span>
    );
  }

  function getTransferBadge(inv: Investor) {
    if (inv.transfer_status === "transferred") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#0ACF83]/10 text-[#0ACF83] border border-[#0ACF83]/20">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          On-chain
        </span>
      );
    }
    if (inv.transfer_status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#FFA500]/10 text-[#FFA500] border border-[#FFA500]/20">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          Pending
        </span>
      );
    }
    if (inv.transfer_status === "failed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#DF1B41]/10 text-[#DF1B41] border border-[#DF1B41]/20">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#8792A2]/10 text-[#8792A2] border border-[#8792A2]/20">
        DB only
      </span>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-[14px]" style={{ color: "#697386" }}>Manage ownership distribution for your properties</p>
      </div>

      {properties.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.12)" }}>
            <svg width="32" height="32" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#1A1F36" }}>No live properties</h2>
          <p className="text-[14px] mb-6" style={{ color: "#697386" }}>Tokenize a property first to add investors.</p>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 text-white font-medium px-6 py-3 rounded-lg text-[14px] transition-all hover:shadow-md"
            style={{ background: "#0ab4aa" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Tokenize Your First Property
          </Link>
        </div>
      ) : (
        <>
          {/* ── Property Selector ── */}
          <div className="glass rounded-xl p-4 flex items-center gap-3 mb-6">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="flex-1 bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[15px] font-medium focus:outline-none focus:border-[#0D9488] transition appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: "40px",
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} – {p.total_slices.toLocaleString()} slices | ${p.valuation_usd.toLocaleString()}
                </option>
              ))}
            </select>
            {currentProperty && (
              <Link
                href={`/dashboard/property/${currentProperty.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E3E8EF] bg-white text-[14px] font-medium transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC]"
                style={{ color: "#1A1F36" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden sm:inline">View Property</span>
              </Link>
            )}
          </div>

          {/* ── Portfolio Overview ── */}
          {currentProperty && (
            <div className="glass rounded-xl p-6 mb-6">
              <h2 className="text-[18px] font-semibold mb-5" style={{ color: "#1A1F36" }}>Portfolio Overview</h2>
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Donut */}
                <div className="relative w-[160px] h-[160px] flex-shrink-0">
                  <DonutChart slices={donutSlices} colors={donutColors} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[28px] font-bold leading-none" style={{ color: "#1A1F36" }}>
                      {Math.round(totalPct)}%
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-5 w-full">
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: "#697386" }}>Property Value</div>
                    <div className="text-[22px] font-bold leading-none" style={{ color: "#1A1F36" }}>
                      ${currentProperty.valuation_usd.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: "#697386" }}>Total Slices</div>
                    <div className="text-[22px] font-bold leading-none" style={{ color: "#1A1F36" }}>
                      {currentProperty.total_slices.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: "#697386" }}>Investors</div>
                    <div className="text-[22px] font-bold leading-none" style={{ color: "#1A1F36" }}>
                      {investors.length}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider mb-1" style={{ color: "#697386" }}>On-chain</div>
                    <div className="text-[22px] font-bold leading-none" style={{ color: "#0ACF83" }}>
                      {investors.filter((i) => i.transfer_status === "transferred").length}
                      <span className="text-[14px] font-medium" style={{ color: "#697386" }}> / {investors.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              {investors.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t" style={{ borderColor: "#E3E8EF" }}>
                  {investors.map((inv, i) => (
                    <div key={inv.id} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[13px] font-medium" style={{ color: "#1A1F36" }}>{inv.name}</span>
                      <span className="text-[13px]" style={{ color: "#697386" }}>{inv.percentage}%</span>
                    </div>
                  ))}
                  {100 - totalPct > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: "#E3E8EF" }} />
                      <span className="text-[13px] font-medium" style={{ color: "#8792A2" }}>Unallocated</span>
                      <span className="text-[13px]" style={{ color: "#8792A2" }}>{(100 - totalPct).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Two-column layout: Table + Add Form ── */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Investor Table */}
            <div className="flex-1 order-2 lg:order-1">
              <div className="glass rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Current Ownership</h2>
                    {investors.length > 0 && (
                      <span className="text-[13px] font-medium" style={{ color: "#697386" }}>
                        {investors.length} investor{investors.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  {/* Transfer status messages */}
                  {transferError && (
                    <div className="flex items-center gap-2 bg-[#DF1B41]/8 border border-[#DF1B41]/20 rounded-lg px-4 py-3 text-[13px] mb-4" style={{ color: "#DF1B41" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {transferError}
                    </div>
                  )}
                  {transferSuccess && (
                    <div className="flex items-center gap-2 bg-[#0ACF83]/8 border border-[#0ACF83]/20 rounded-lg px-4 py-3 text-[13px] mb-4" style={{ color: "#0ACF83" }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {transferSuccess}
                    </div>
                  )}

                  {investors.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(135,146,162,0.08)" }}>
                        <svg width="24" height="24" fill="none" stroke="#8792A2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <p className="text-[14px] font-medium" style={{ color: "#697386" }}>No investors added yet</p>
                      <p className="text-[13px] mt-1" style={{ color: "#8792A2" }}>Use the form to add your first investor.</p>
                    </div>
                  ) : (
                    <>
                      {/* Column headers */}
                      <div className="hidden md:grid grid-cols-12 gap-4 pb-3 mb-1 border-b" style={{ borderColor: "#E3E8EF" }}>
                        <div className="col-span-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Investor</div>
                        <div className="col-span-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Slices</div>
                        <div className="col-span-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8792A2" }}>Wallet</div>
                        <div className="col-span-3 text-[11px] font-semibold uppercase tracking-wider text-right" style={{ color: "#8792A2" }}>Value</div>
                      </div>

                      <div className="divide-y" style={{ borderColor: "#E3E8EF" }}>
                        {investors.map((inv, i) => (
                          <div key={inv.id} className="py-4 first:pt-3">
                            {/* Main row */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                              {/* Investor */}
                              <div className="col-span-4 flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
                                  style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
                                >
                                  {getInitials(inv.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[14px] font-semibold" style={{ color: "#1A1F36" }}>{inv.name}</span>
                                    {getTransferBadge(inv)}
                                  </div>
                                  {inv.email && (
                                    <div className="text-[13px] truncate" style={{ color: "#697386" }}>{inv.email}</div>
                                  )}
                                </div>
                              </div>

                              {/* Slices */}
                              <div className="col-span-2">
                                <div className="text-[14px] font-semibold" style={{ color: "#1A1F36" }}>
                                  {inv.slices_owned.toLocaleString()}
                                </div>
                                <div className="text-[12px]" style={{ color: "#697386" }}>{inv.percentage}% ownership</div>
                              </div>

                              {/* Wallet */}
                              <div className="col-span-3">
                                {editingWallet === inv.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={editWalletValue}
                                      onChange={(e) => setEditWalletValue(e.target.value)}
                                      placeholder="0.0.XXXXX"
                                      className="flex-1 bg-[#F6F9FC] border border-[#E3E8EF] rounded-lg px-3 py-1.5 text-[13px] font-mono focus:outline-none focus:border-[#0D9488] transition"
                                    />
                                    <button
                                      onClick={() => handleSaveWallet(inv.id)}
                                      className="text-[12px] font-medium hover:underline"
                                      style={{ color: "#0ACF83" }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => { setEditingWallet(null); setEditWalletValue(""); }}
                                      className="text-[12px] hover:underline"
                                      style={{ color: "#8792A2" }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {inv.wallet_address ? (
                                      <span className="text-[13px] font-mono" style={{ color: "#1A1F36" }}>
                                        {inv.wallet_address.length > 14
                                          ? inv.wallet_address.slice(0, 8) + "..." + inv.wallet_address.slice(-4)
                                          : inv.wallet_address}
                                      </span>
                                    ) : (
                                      <span className="text-[13px] italic" style={{ color: "#8792A2" }}>Not set</span>
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingWallet(inv.id);
                                        setEditWalletValue(inv.wallet_address || "");
                                      }}
                                      className="text-[12px] font-medium hover:underline"
                                      style={{ color: "#0ab4aa" }}
                                    >
                                      {inv.wallet_address ? "Edit" : "Add"}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Value */}
                              <div className="col-span-3 text-right">
                                <div className="text-[15px] font-semibold" style={{ color: "#1A1F36" }}>
                                  ${Math.round(pricePerSlice * inv.slices_owned).toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Expandable detail row: KYC + Transfer */}
                            <div className="mt-3 ml-0 md:ml-[52px] flex flex-wrap items-center gap-3">
                              {/* KYC badge + controls */}
                              <div className="flex items-center gap-2">
                                {getKycBadge(inv)}
                                {updatingKyc === inv.id ? (
                                  <span className="text-[11px]" style={{ color: "#8792A2" }}>Updating...</span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {(inv.kyc_status || "unverified") !== "verified" && (
                                      <button
                                        onClick={() => handleKycUpdate(inv.id, "verified")}
                                        className="text-[11px] font-medium hover:underline"
                                        style={{ color: "#0ACF83" }}
                                      >
                                        Verify
                                      </button>
                                    )}
                                    {(inv.kyc_status || "unverified") !== "pending" && inv.kyc_status !== "verified" && (
                                      <button
                                        onClick={() => handleKycUpdate(inv.id, "pending")}
                                        className="text-[11px] font-medium hover:underline"
                                        style={{ color: "#FFA500" }}
                                      >
                                        Pending
                                      </button>
                                    )}
                                    {inv.kyc_status === "verified" && (
                                      <button
                                        onClick={() => handleKycUpdate(inv.id, "unverified")}
                                        className="text-[11px] hover:underline"
                                        style={{ color: "#8792A2" }}
                                      >
                                        Reset
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Transfer button */}
                              {inv.wallet_address && inv.transfer_status !== "transferred" && currentProperty?.share_token_id && (
                                <button
                                  onClick={() => handleTransfer(inv.id, inv.name)}
                                  disabled={transferring === inv.id}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12px] font-medium transition-all disabled:opacity-50 hover:shadow-md"
                                  style={{ background: "linear-gradient(135deg, #6c5ce7, #a29bfe)" }}
                                >
                                  {transferring === inv.id ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                      Transferring...
                                    </>
                                  ) : (
                                    <>
                                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                      Transfer {inv.slices_owned.toLocaleString()} Slices
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Transfer TX link */}
                              {inv.transfer_status === "transferred" && inv.transfer_tx_id && (
                                <a
                                  href={(() => {
                                    const net = currentProperty?.network || "mainnet";
                                    const parts = inv.transfer_tx_id!.split("@");
                                    if (parts.length === 2) {
                                      return `https://hashscan.io/${net}/transaction/${parts[0]}-${parts[1].replace(".", "-")}`;
                                    }
                                    return `https://hashscan.io/${net}/transaction/${inv.transfer_tx_id}`;
                                  })()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline"
                                  style={{ color: "#0ab4aa" }}
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  View on HashScan
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Allocation summary */}
                  {currentProperty && investors.length > 0 && (
                    <div className="mt-5 pt-4 border-t" style={{ borderColor: "#E3E8EF" }}>
                      <div className="grid grid-cols-3 gap-4 text-[13px]">
                        <div>
                          <span style={{ color: "#697386" }}>Allocated</span>
                          <div className="font-semibold mt-0.5" style={{ color: "#1A1F36" }}>
                            {totalAllocated.toLocaleString()} / {currentProperty.total_slices.toLocaleString()} slices
                          </div>
                        </div>
                        <div>
                          <span style={{ color: "#697386" }}>Available</span>
                          <div className="font-semibold mt-0.5" style={{ color: "#0ACF83" }}>
                            {(currentProperty.total_slices - totalAllocated).toLocaleString()} slices
                          </div>
                        </div>
                        <div className="text-right">
                          <span style={{ color: "#697386" }}>Total Value</span>
                          <div className="font-semibold mt-0.5" style={{ color: "#1A1F36" }}>
                            ${currentProperty.valuation_usd.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transfer All Button */}
                  {currentProperty?.share_token_id && investors.some((i) => i.wallet_address && i.transfer_status !== "transferred") && (
                    <button
                      onClick={async () => {
                        const eligible = investors.filter((i) => i.wallet_address && i.transfer_status !== "transferred");
                        setTransferError("");
                        setTransferSuccess("");
                        let successCount = 0;
                        let failCount = 0;
                        for (const inv of eligible) {
                          setTransferring(inv.id);
                          try {
                            const res = await fetch("/api/investors/transfer", {
                              method: "POST",
                              headers: getAuthHeaders(session!),
                              body: JSON.stringify({ investorId: inv.id }),
                            });
                            const data = await res.json();
                            if (!res.ok) { failCount++; continue; }
                            successCount++;
                          } catch { failCount++; }
                        }
                        setTransferring(null);
                        if (successCount > 0) setTransferSuccess(`Transferred tokens to ${successCount} investor${successCount !== 1 ? "s" : ""}${failCount > 0 ? ` (${failCount} failed)` : ""}`);
                        else if (failCount > 0) setTransferError(`All ${failCount} transfers failed. Check wallet addresses and token associations.`);
                        // Refresh
                        const refreshRes = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session!) });
                        const refreshData = await refreshRes.json();
                        setInvestors(refreshData.investors || []);
                      }}
                      disabled={!!transferring}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 text-[13px] hover:shadow-md"
                      style={{ background: "linear-gradient(135deg, #6c5ce7, #a29bfe)" }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                      Transfer All Pending Investors On-chain
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Add Investor Form — shows first on mobile */}
            <div className="w-full lg:w-[360px] flex-shrink-0 order-1 lg:order-2">
              <div className="glass rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
                  <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Add Investor</h2>
                </div>
                <div className="p-6">
                  <form onSubmit={handleAddInvestor} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                        Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                        placeholder="Investor name"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                        placeholder="investor@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                        Hedera Wallet Address
                      </label>
                      <input
                        type="text"
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[#0D9488] transition"
                        placeholder="0.0.XXXXX"
                      />
                      <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "#8792A2" }}>
                        Required for on-chain token transfers. Investor must associate the share token in their wallet first.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                        Slices
                      </label>
                      <input
                        type="number"
                        value={slices}
                        onChange={(e) => setSlices(e.target.value)}
                        required
                        min="1"
                        className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                        placeholder="100"
                      />
                      {slices && currentProperty && (
                        <p className="text-[12px] mt-1.5" style={{ color: "#697386" }}>
                          = {((Number(slices) / currentProperty.total_slices) * 100).toFixed(2)}% ownership
                          (${(Math.round(pricePerSlice) * Number(slices)).toLocaleString()} value)
                        </p>
                      )}
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 bg-[#DF1B41]/8 border border-[#DF1B41]/20 rounded-lg px-4 py-2.5 text-[13px]" style={{ color: "#DF1B41" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="flex items-center gap-2 bg-[#0ACF83]/8 border border-[#0ACF83]/20 rounded-lg px-4 py-2.5 text-[13px]" style={{ color: "#0ACF83" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        {success}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={adding || !name || !slices}
                      className="w-full inline-flex items-center justify-center gap-2 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 text-[14px] hover:shadow-md"
                      style={{ background: "#0ab4aa" }}
                    >
                      {adding ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add Investor
                        </>
                      )}
                    </button>

                    <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: "rgba(10,180,170,0.04)", border: "1px solid rgba(10,180,170,0.12)" }}>
                      <svg width="14" height="14" fill="none" stroke="#0ab4aa" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-[11px] leading-relaxed" style={{ color: "#697386" }}>
                        Adding an investor creates a tamper-proof record on the HCS audit trail.
                      </p>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}