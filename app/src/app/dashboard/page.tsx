"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
import ActionItems from "@/components/ActionItems";
import type { Property } from "@/types/database";

export default function DashboardPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/properties", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .finally(() => setLoading(false));
  }, [session]);

  const stats = useMemo(() => {
    const live = properties.filter((p) => p.status === "live");
    const totalValue = live.reduce((s, p) => s + (p.valuation_usd || 0), 0);
    return {
      totalProperties: live.length,
      totalValue,
      pending: properties.filter((p) => p.status === "deploying").length,
    };
  }, [properties]);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      live: "bg-[rgba(10,207,131,0.1)] text-[#0ACF83]",
      deploying: "bg-[rgba(255,165,0,0.1)] text-[#FFA500]",
      draft: "bg-[rgba(135,146,162,0.15)] text-[#8792A2]",
      failed: "bg-[rgba(223,27,65,0.1)] text-[#DF1B41]",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${styles[status] || styles.draft}`}>
        {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-[#0ACF83]" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="animate-fade-in">
      {/* Stats overview */}
      {!loading && properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Portfolio Value — Featured */}
          <div
            className="rounded-xl p-6 text-white"
            style={{
              background: "linear-gradient(135deg, #17a2b8 0%, #138496 100%)",
              boxShadow: "var(--ds-shadow-sm)",
            }}
          >
            <div className="text-[13px] font-medium uppercase tracking-wide opacity-90 mb-2">Portfolio Value</div>
            <div className="text-[32px] font-bold leading-none">${stats.totalValue.toLocaleString()}</div>
            <div className="text-[13px] mt-2 opacity-80">{stats.totalProperties} active propert{stats.totalProperties !== 1 ? "ies" : "y"}</div>
          </div>
          {/* Properties */}
          <div className="glass rounded-xl p-6">
            <div className="text-[13px] font-medium uppercase tracking-wide text-[#697386] mb-2">Properties</div>
            <div className="text-[32px] font-bold leading-none" style={{ color: "var(--ds-text)" }}>{stats.totalProperties}</div>
            <div className="text-[13px] mt-2" style={{ color: "var(--ds-muted)" }}>
              {stats.pending > 0 ? <><span className="text-[#0ACF83] font-medium">↑ {stats.pending}</span> pending</> : "active"}
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--ds-text)" }}>Properties</h2>
          <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Manage your tokenized real estate assets</p>
        </div>
        <Link
          href="/dashboard/new"
          className="inline-flex items-center gap-2 text-white font-medium px-5 py-2.5 rounded-lg text-[14px] transition-all hover:shadow-md text-center shrink-0"
          style={{
            background: "#0D9488",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tokenize Property
        </Link>
      </div>

      <ActionItems />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="ds-glow">
          <div className="glass rounded-xl p-16 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl" style={{
              background: "rgba(13,148,136,0.08)",
              border: "1px solid rgba(13,148,136,0.12)",
            }}>
              🏠
            </div>
            <h2 className="text-xl font-semibold mb-3" style={{ color: "var(--ds-text)" }}>No properties yet</h2>
            <p className="text-[14px] max-w-md mx-auto mb-8" style={{ color: "var(--ds-text-secondary)", lineHeight: "1.7" }}>
              Tokenize your first property to create an NFT deed, share tokens, and a verifiable audit trail — all on Hedera.
            </p>
            <Link
              href="/dashboard/new"
              className="inline-flex text-white font-medium px-8 py-3.5 rounded-lg text-[14px] transition-all hover:shadow-md"
              style={{ background: "#0D9488" }}
            >
              Tokenize Your First Property
            </Link>
            <p className="text-[12px] mt-4" style={{ color: "var(--ds-muted)" }}>
              ~$0.01 in Hedera fees · Takes about 10 seconds
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {properties.map((p, i) => (
            <Link
              key={p.id}
              href={`/dashboard/property/${p.id}`}
              className="glass rounded-xl overflow-hidden group cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Property Image */}
              {p.image_url ? (
                <div className="w-full h-[220px] overflow-hidden">
                  <img
                    src={p.image_url}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              ) : (
                <div className="w-full h-[220px] flex items-center justify-center text-5xl"
                  style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.06) 0%, rgba(99,102,241,0.04) 100%)" }}>
                  🏠
                </div>
              )}

              <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[16px] font-semibold group-hover:text-[#0D9488] transition" style={{ color: "var(--ds-text)" }}>{p.name}</h3>
                  {p.address && <p className="text-[14px] mt-0.5" style={{ color: "var(--ds-muted)" }}>{p.address}</p>}
                </div>
                {statusBadge(p.status)}
              </div>

              {/* Stats grid like upgrade UI */}
              <div className="grid grid-cols-2 gap-4 pt-4 mt-3 border-t" style={{ borderColor: "var(--ds-border)" }}>
                <div>
                  <div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--ds-muted)" }}>Value</div>
                  <div className="text-[16px] font-semibold mt-0.5" style={{ color: "var(--ds-text)" }}>${p.valuation_usd.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--ds-muted)" }}>Slices</div>
                  <div className="text-[16px] font-semibold mt-0.5" style={{ color: "var(--ds-text)" }}>{p.total_slices.toLocaleString()}</div>
                </div>
                {p.share_token_id && (
                  <div>
                    <div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--ds-muted)" }}>Token</div>
                    <div className="text-[14px] font-mono font-medium mt-0.5" style={{ color: "var(--ds-text)" }}>{p.share_token_symbol}</div>
                  </div>
                )}
                <div>
                  <div className="text-[12px] uppercase tracking-wide" style={{ color: "var(--ds-muted)" }}>Per Slice</div>
                  <div className="text-[14px] font-semibold mt-0.5" style={{ color: "var(--ds-text)" }}>${Math.round(p.valuation_usd / p.total_slices).toLocaleString()}</div>
                </div>
              </div>

              {/* Network badge */}
              <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[11px]" style={{ borderColor: "var(--ds-border)", color: "var(--ds-muted)" }}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.network === "mainnet" ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
                {p.network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"}
                {p.deployed_at && ` · ${new Date(p.deployed_at).toLocaleDateString()}`}
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
