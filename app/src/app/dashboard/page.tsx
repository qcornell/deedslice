"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
import dynamic from "next/dynamic";
const DistributionChart = dynamic(() => import("@/components/DistributionChart"), {
  loading: () => <div className="h-48 bg-[#E3E8EF] rounded-lg animate-pulse" />,
  ssr: false,
});
import type { Property, Investor, AuditEntry } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════
 *  Dashboard — Two-column layout matching upgrade mockup
 *  Left: Stats → Properties list
 *  Right: Top Investors · Recent Activity · Quick Actions
 * ═══════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load dashboard data — try summary endpoint, fall back to original pattern
  useEffect(() => {
    if (!session) return;
    const h = getAuthHeaders(session);

    fetch("/api/dashboard/summary", { headers: h })
      .then(r => {
        if (!r.ok) throw new Error("summary failed");
        return r.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error);
        setProperties(data.properties || []);
        setInvestors(data.investors || []);
        setAuditEntries(data.auditEntries || []);
      })
      .catch(() => {
        // Fallback: original pattern (properties + audit separately)
        Promise.all([
          fetch("/api/properties", { headers: h }).then(r => r.json()),
          fetch("/api/audit/all", { headers: h }).then(r => r.json()).catch(() => ({ auditEntries: [] })),
        ]).then(([propData, auditData]) => {
          const props = propData.properties || [];
          setProperties(props);
          setAuditEntries((auditData.auditEntries || []).slice(0, 5));

          const liveProps = props.filter((p: Property) => p.status === "live");
          if (liveProps.length > 0) {
            Promise.all(
              liveProps.map((p: Property) =>
                fetch(`/api/properties/${p.id}`, { headers: h })
                  .then(r => r.json())
                  .then(d => (d.investors || []).map((inv: Investor) => ({ ...inv, _propertyName: p.name })))
                  .catch(() => [])
              )
            ).then(results => setInvestors(results.flat()));
          }
        }).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [session]);

  const stats = useMemo(() => {
    const live = properties.filter(p => p.status === "live");
    const totalValue = live.reduce((s, p) => s + (p.valuation_usd || 0), 0);
    const totalInvestors = investors.length;
    const pending = properties.filter(p => p.status === "deploying").length;
    return { totalProperties: live.length, totalValue, totalInvestors, pending };
  }, [properties, investors]);

  // Top investors by slices_owned (deduplicated by name, summed)
  const topInvestors = useMemo(() => {
    const map = new Map<string, { name: string; email: string | null; total: number }>();
    for (const inv of investors) {
      const existing = map.get(inv.name) || { name: inv.name, email: inv.email, total: 0 };
      existing.total += inv.slices_owned;
      map.set(inv.name, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [investors]);

  const avatarGradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  ];

  const activityIcons: Record<string, { icon: string; bgClass: string; colorClass: string }> = {
    PROPERTY_TOKENIZED: { icon: "✓", bgClass: "bg-[rgba(23,162,184,0.1)]", colorClass: "text-[#17a2b8]" },
    INVESTOR_ADDED: { icon: "👤", bgClass: "bg-[rgba(59,130,246,0.1)]", colorClass: "text-[#3B82F6]" },
    INVESTOR_UPDATED: { icon: "✏", bgClass: "bg-[rgba(59,130,246,0.1)]", colorClass: "text-[#3B82F6]" },
    TOKENS_TRANSFERRED: { icon: "✓", bgClass: "bg-[rgba(10,207,131,0.1)]", colorClass: "text-[#0ACF83]" },
    DISTRIBUTION_RECORDED: { icon: "✓", bgClass: "bg-[rgba(10,207,131,0.1)]", colorClass: "text-[#0ACF83]" },
    DOCUMENT_ADDED: { icon: "📄", bgClass: "bg-[rgba(23,162,184,0.1)]", colorClass: "text-[#17a2b8]" },
  };
  const defaultActivity = { icon: "•", bgClass: "bg-[rgba(135,146,162,0.1)]", colorClass: "text-[#8792A2]" };

  // Auto-seed demo data for new users with empty dashboards
  const [seeding, setSeeding] = useState(false);
  const [demoSeeded, setDemoSeeded] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function seedDemo() {
    if (!session || seeding) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", {
        method: "POST",
        headers: getAuthHeaders(session),
      });
      const data = await res.json();
      if (data.ok && data.propertyId) {
        setDemoSeeded(true);
        // Reload dashboard data
        const summaryRes = await fetch("/api/dashboard/summary", { headers: getAuthHeaders(session) });
        const summaryData = await summaryRes.json();
        setProperties(summaryData.properties || []);
        setInvestors(summaryData.investors || []);
        setAuditEntries(summaryData.auditEntries || []);
      }
    } catch {} finally {
      setSeeding(false);
    }
  }

  if (properties.length === 0 && !demoSeeded) {
    return (
      <div className="max-w-xl mx-auto animate-fade-in">
        <div className="glass rounded-xl p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{
            background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.12)",
          }}>
            <svg width="40" height="40" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--ds-text)" }}>No properties yet</h2>
          <p className="text-[14px] max-w-md mx-auto mb-6" style={{ color: "#697386", lineHeight: "1.7" }}>
            Tokenize your first property to create an NFT deed, share tokens, and a verifiable audit trail — all on Hedera.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Link
              href="/dashboard/new"
              className="inline-flex items-center justify-center gap-2 text-white font-medium px-8 py-3.5 rounded-lg text-[14px] transition-all hover:shadow-md"
              style={{ background: "#0ab4aa" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Tokenize Your First Property
            </Link>
            <button
              onClick={seedDemo}
              disabled={seeding}
              className="inline-flex items-center justify-center gap-2 font-medium px-8 py-3.5 rounded-lg text-[14px] transition-all border hover:bg-[#F6F9FC] disabled:opacity-50"
              style={{ borderColor: "#E3E8EF", color: "#697386" }}
            >
              {seeding ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#697386]/30 border-t-[#697386] rounded-full animate-spin" />
                  Loading demo...
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Explore with Demo Data
                </>
              )}
            </button>
          </div>

          <p className="text-[12px]" style={{ color: "#8792A2" }}>~$0.01 in Hedera fees · Takes about 10 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ── Stats Grid (4 cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {/* Portfolio Value — Featured teal */}
        <div className="rounded-xl p-6 text-white" style={{ background: "linear-gradient(135deg, #17a2b8 0%, #138496 100%)", boxShadow: "0 1px 3px rgba(50,50,93,0.15)" }}>
          <div className="text-[13px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Portfolio Value</div>
          <div className="text-[32px] font-bold leading-none">${stats.totalValue.toLocaleString()}</div>
          <div className="text-[13px] mt-3 flex items-center gap-1" style={{ color: "rgba(255,255,255,0.9)" }}>
            <span className="font-medium">↑</span> {stats.totalProperties} active propert{stats.totalProperties !== 1 ? "ies" : "y"}
          </div>
        </div>

        {/* Properties */}
        <div className="glass rounded-xl p-6">
          <div className="text-[13px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color: "#697386" }}>Properties</div>
          <div className="text-[32px] font-bold leading-none" style={{ color: "#1A1F36" }}>{stats.totalProperties}</div>
          <div className="text-[13px] mt-3" style={{ color: "#697386" }}>active</div>
          {stats.pending > 0 && (
            <div className="mt-2 pt-2 border-t text-[13px]" style={{ borderColor: "rgba(0,0,0,0.05)", color: "#697386" }}>
              <span className="text-[#0ACF83] font-medium">↑ {stats.pending}</span> pending
            </div>
          )}
        </div>

        {/* Investors */}
        <div className="glass rounded-xl p-6">
          <div className="text-[13px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color: "#697386" }}>Investors</div>
          <div className="text-[32px] font-bold leading-none" style={{ color: "#1A1F36" }}>{stats.totalInvestors}</div>
          <div className="text-[13px] mt-3" style={{ color: "#697386" }}>total</div>
        </div>

        {/* Distributions */}
        <div className="glass rounded-xl p-6">
          <div className="text-[13px] font-medium uppercase tracking-[0.5px] mb-2" style={{ color: "#697386" }}>Distributions</div>
          <div className="text-[32px] font-bold leading-none" style={{ color: "#1A1F36" }}>—</div>
          <div className="text-[13px] mt-3" style={{ color: "#697386" }}>YTD</div>
        </div>
      </div>

      {/* ── Distribution Chart ── */}
      <div className="glass rounded-xl p-6 mb-8">
        <h2 className="text-[18px] font-semibold mb-5" style={{ color: "#1A1F36" }}>Distribution Income</h2>
        <DistributionChart properties={properties} session={session} />
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Main Column ── */}
        <div className="flex-1 min-w-0">
          {/* Properties Section */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Properties</h2>
            <Link
              href="/dashboard/new"
              className="inline-flex items-center gap-2 text-white font-medium px-4 py-2 rounded-lg text-[14px] transition-all hover:shadow-md"
              style={{ background: "#0ab4aa" }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tokenize Property
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/property/${p.id}`}
                className="glass rounded-xl p-6 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="text-[16px] font-semibold mb-4 group-hover:text-[#0D9488] transition" style={{ color: "#1A1F36" }}>{p.name}</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[14px]">
                    <span style={{ color: "#697386" }}>Value:</span>
                    <span className="font-semibold" style={{ color: "#1A1F36" }}>${p.valuation_usd.toLocaleString()}</span>
                  </div>
                  {p.address && (
                    <div className="flex justify-between text-[14px]">
                      <span style={{ color: "#697386" }}>Address:</span>
                      <span className="font-medium text-right max-w-[200px] truncate" style={{ color: "#1A1F36" }}>{p.address}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[14px]">
                    <span style={{ color: "#697386" }}>Slices:</span>
                    <span className="font-semibold" style={{ color: "#1A1F36" }}>{p.total_slices.toLocaleString()}</span>
                  </div>
                  {p.share_token_symbol && (
                    <div className="flex justify-between text-[14px]">
                      <span style={{ color: "#697386" }}>Token:</span>
                      <span className="font-mono font-medium" style={{ color: "#1A1F36" }}>{p.share_token_symbol}</span>
                    </div>
                  )}
                </div>
                {/* Network */}
                <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[12px]" style={{ borderColor: "#E3E8EF", color: "#8792A2" }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.network === "mainnet" ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
                  {p.network === "mainnet" ? "Mainnet" : "Testnet"}
                  {p.deployed_at && ` · ${new Date(p.deployed_at).toLocaleDateString()}`}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Right Sidebar Column (320px) ── */}
        <div className="w-full xl:w-[320px] flex-shrink-0 space-y-5">
          {/* Top Investors */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-[16px] font-semibold mb-4" style={{ color: "#1A1F36" }}>Top Investors</h3>
            {topInvestors.length === 0 ? (
              <p className="text-[14px]" style={{ color: "#8792A2" }}>No investors yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#E3E8EF" }}>
                {topInvestors.map((inv, i) => {
                  const initials = inv.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0"
                          style={{ background: avatarGradients[i % avatarGradients.length] }}
                        >
                          {initials}
                        </div>
                        <span className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>{inv.name}</span>
                      </div>
                      <span className="text-[14px] font-semibold" style={{ color: "#1A1F36" }}>{inv.total.toLocaleString()} slices</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-[16px] font-semibold mb-4" style={{ color: "#1A1F36" }}>Recent Activity</h3>
            {auditEntries.length === 0 ? (
              <p className="text-[14px]" style={{ color: "#8792A2" }}>No activity yet.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "#E3E8EF" }}>
                {auditEntries.map((entry) => {
                  const cfg = activityIcons[entry.action] || defaultActivity;
                  return (
                    <div key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[14px] ${cfg.bgClass} ${cfg.colorClass}`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>
                          {entry.action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                        </div>
                        {entry.details && (
                          <div className="text-[13px] truncate" style={{ color: "#697386" }}>{entry.details}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-[16px] font-semibold mb-4" style={{ color: "#1A1F36" }}>Quick Actions</h3>
            <div className="space-y-2">
              <Link href="/dashboard/new" className="flex items-center gap-3 px-3 py-3 rounded-lg border transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] text-[14px] font-medium" style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}>
                <svg width="16" height="16" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Tokenize Property
              </Link>
              <Link href="/dashboard/investors" className="flex items-center gap-3 px-3 py-3 rounded-lg border transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] text-[14px] font-medium" style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}>
                <svg width="16" height="16" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Investor
              </Link>
              <Link href="/dashboard/distributions" className="flex items-center gap-3 px-3 py-3 rounded-lg border transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] text-[14px] font-medium" style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}>
                <svg width="16" height="16" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Record Distribution
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
