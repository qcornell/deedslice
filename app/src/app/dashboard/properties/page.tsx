"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
import type { Property } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════
 *  Properties Page — matching Claude Code mockup exactly
 *  - Subtitle + header actions (Export + Tokenize New Property)
 *  - 4 stat cards (Total Properties, Total Value, Active, Avg Token Price)
 *  - Filter bar: search + status + type + sort dropdowns
 *  - Property cards: image → title + location + status badge → 2×2 stats → footer buttons
 * ═══════════════════════════════════════════════════════════════ */

// Shared select styling
const selectStyle: React.CSSProperties = {
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "36px",
};

export default function PropertiesPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    if (!session) return;
    fetch("/api/properties", { headers: getAuthHeaders(session) })
      .then(r => r.json())
      .then(d => setProperties(d.properties || []))
      .finally(() => setLoading(false));
  }, [session]);

  // Stats
  const stats = useMemo(() => {
    const live = properties.filter(p => p.status === "live");
    const totalValue = live.reduce((s, p) => s + (p.valuation_usd || 0), 0);
    const totalSlices = live.reduce((s, p) => s + p.total_slices, 0);
    const avgPrice = totalSlices > 0 ? Math.round(totalValue / totalSlices) : 0;
    return {
      total: properties.length,
      totalValue,
      active: live.length,
      avgPrice,
    };
  }, [properties]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = [...properties];

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.address || "").toLowerCase().includes(q)
      );
    }

    // Status
    if (statusFilter !== "all") {
      list = list.filter(p => p.status === statusFilter);
    }

    // Type
    if (typeFilter !== "all") {
      list = list.filter(p => p.property_type === typeFilter);
    }

    // Sort
    switch (sortBy) {
      case "newest":
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "value-high":
        list.sort((a, b) => b.valuation_usd - a.valuation_usd);
        break;
      case "value-low":
        list.sort((a, b) => a.valuation_usd - b.valuation_usd);
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return list;
  }, [properties, search, statusFilter, typeFilter, sortBy]);

  const statusBadge = (status: string) => {
    const cfg: Record<string, { bg: string; color: string; label: string }> = {
      live: { bg: "rgba(10,207,131,0.1)", color: "#0ACF83", label: "Active" },
      deploying: { bg: "rgba(255,165,0,0.1)", color: "#FFA500", label: "Pending" },
      draft: { bg: "rgba(135,146,162,0.15)", color: "#8792A2", label: "Draft" },
      failed: { bg: "rgba(223,27,65,0.1)", color: "#DF1B41", label: "Failed" },
    };
    const c = cfg[status] || cfg.draft;
    return (
      <span className="inline-block px-2.5 py-1 rounded-full text-[12px]" style={{ background: c.bg, color: c.color, fontWeight: 500 }}>
        {c.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[14px]" style={{ color: "#697386" }}>Manage and monitor your tokenized properties</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[14px] transition-all hover:bg-[#F6F9FC]" style={{ borderColor: "#E3E8EF", color: "#1A1F36", background: "white" }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Export
          </button>
          <Link href="/dashboard/new" className="inline-flex items-center gap-2 text-white px-4 py-2.5 rounded-lg text-[14px] transition-all hover:shadow-md" style={{ background: "#0ab4aa", fontWeight: 500 }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Tokenize New Property
          </Link>
        </div>
      </div>

      {/* ── Stats Overview ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <div className="glass rounded-xl p-5">
          <div className="text-[13px] uppercase tracking-[0.3px] mb-2" style={{ color: "#697386", fontWeight: 500 }}>Total Properties</div>
          <div className="text-[28px]" style={{ color: "#1A1F36", fontWeight: 700 }}>{stats.total}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-[13px] uppercase tracking-[0.3px] mb-2" style={{ color: "#697386", fontWeight: 500 }}>Total Value</div>
          <div className="text-[28px]" style={{ color: "#1A1F36", fontWeight: 700 }}>${stats.totalValue >= 1_000_000 ? `${(stats.totalValue / 1_000_000).toFixed(1)}M` : stats.totalValue.toLocaleString()}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-[13px] uppercase tracking-[0.3px] mb-2" style={{ color: "#697386", fontWeight: 500 }}>Active Listings</div>
          <div className="text-[28px]" style={{ color: "#1A1F36", fontWeight: 700 }}>{stats.active}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <div className="text-[13px] uppercase tracking-[0.3px] mb-2" style={{ color: "#697386", fontWeight: 500 }}>Avg. Token Price</div>
          <div className="text-[28px]" style={{ color: "#1A1F36", fontWeight: 700 }}>${stats.avgPrice}</div>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-[250px] relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search properties..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border text-[14px] transition-all"
            style={{ borderColor: "#E3E8EF", background: "white" }}
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-2.5 pl-3 rounded-lg border text-[14px]" style={{ ...selectStyle, borderColor: "#E3E8EF", background: "white" }}>
          <option value="all">All Statuses</option>
          <option value="live">Active</option>
          <option value="deploying">Pending</option>
          <option value="draft">Draft</option>
          <option value="failed">Failed</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="py-2.5 pl-3 rounded-lg border text-[14px]" style={{ ...selectStyle, borderColor: "#E3E8EF", background: "white" }}>
          <option value="all">All Types</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
          <option value="mixed">Mixed Use</option>
          <option value="land">Land</option>
          <option value="industrial">Industrial</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="py-2.5 pl-3 rounded-lg border text-[14px]" style={{ ...selectStyle, borderColor: "#E3E8EF", background: "white" }}>
          <option value="newest">Sort by: Newest</option>
          <option value="value-high">Sort by: Value (High)</option>
          <option value="value-low">Sort by: Value (Low)</option>
          <option value="name">Sort by: Name</option>
        </select>
      </div>

      {/* ── Properties Grid ── */}
      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <svg className="mx-auto mb-4 opacity-20" width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          <p className="text-[14px]" style={{ color: "#8792A2" }}>
            {search || statusFilter !== "all" || typeFilter !== "all" ? "No properties match your filters." : "No properties yet. Tokenize your first one!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p) => {
            const pricePerSlice = p.total_slices > 0 ? Math.round(p.valuation_usd / p.total_slices) : 0;
            return (
              <div key={p.id} className="glass rounded-xl overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5" style={{ border: "1px solid transparent" }}>
                {/* Image */}
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-[220px] object-cover" />
                ) : (
                  <div className="w-full h-[220px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
                    <svg width="48" height="48" fill="none" stroke="rgba(255,255,255,0.6)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                )}

                {/* Content */}
                <div className="p-5">
                  {/* Title + Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[18px] mb-1" style={{ color: "#1A1F36", fontWeight: 600 }}>{p.name}</div>
                      {p.address && <div className="text-[14px] truncate" style={{ color: "#697386" }}>{p.address}</div>}
                    </div>
                    <div className="ml-3 flex-shrink-0">{statusBadge(p.status)}</div>
                  </div>

                  {/* 2×2 Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4 pb-4 border-t" style={{ borderColor: "#E3E8EF" }}>
                    <div>
                      <div className="text-[12px] uppercase tracking-[0.3px] mb-1" style={{ color: "#8792A2" }}>Total Supply</div>
                      <div className="text-[16px]" style={{ color: "#1A1F36", fontWeight: 600 }}>{p.total_slices.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[12px] uppercase tracking-[0.3px] mb-1" style={{ color: "#8792A2" }}>Token Price</div>
                      <div className="text-[16px]" style={{ color: "#1A1F36", fontWeight: 600 }}>${pricePerSlice}</div>
                    </div>
                    <div>
                      <div className="text-[12px] uppercase tracking-[0.3px] mb-1" style={{ color: "#8792A2" }}>Valuation</div>
                      <div className="text-[16px]" style={{ color: "#1A1F36", fontWeight: 600 }}>${p.valuation_usd.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[12px] uppercase tracking-[0.3px] mb-1" style={{ color: "#8792A2" }}>Network</div>
                      <div className="flex items-center gap-1.5 text-[14px]" style={{ color: "#1A1F36", fontWeight: 500 }}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.network === "mainnet" ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
                        {p.network === "mainnet" ? "Mainnet" : "Testnet"}
                      </div>
                    </div>
                  </div>

                  {/* Footer Buttons */}
                  <div className="flex gap-2 pt-4 border-t" style={{ borderColor: "#E3E8EF" }}>
                    <Link
                      href={`/dashboard/property/${p.id}`}
                      className="flex-1 text-center py-2 rounded-lg text-[13px] transition-all hover:shadow-sm"
                      style={{ background: "#0ab4aa", color: "white", fontWeight: 500 }}
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/dashboard/property/${p.id}`}
                      className="flex-1 text-center py-2 rounded-lg border text-[13px] transition-all hover:bg-[#F6F9FC]"
                      style={{ borderColor: "#E3E8EF", color: "#1A1F36", fontWeight: 500 }}
                    >
                      Manage
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
