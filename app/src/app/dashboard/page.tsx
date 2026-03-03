"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      live: "bg-ds-green/15 text-ds-green border-ds-green/30",
      deploying: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
      draft: "bg-ds-muted/15 text-ds-muted border-ds-muted/30",
      failed: "bg-ds-red/15 text-ds-red border-ds-red/30",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${styles[status] || styles.draft}`}>
        {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold heading-tight">Properties</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ds-muted)" }}>Manage your tokenized real estate assets</p>
        </div>
        <Link
          href="/dashboard/new"
          className="text-white font-semibold px-5 py-2.5 rounded-[10px] text-[13px] transition-all hover:translate-y-[-1px]"
          style={{
            background: "linear-gradient(135deg, #0D9488, #e17055)",
            boxShadow: "0 2px 8px rgba(13,148,136,0.25), 0 1px 2px rgba(13,148,136,0.15)",
          }}
        >
          + Tokenize Property
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="ds-glow">
          <div className="glass rounded-[20px] p-16 text-center relative z-10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl" style={{
              background: "linear-gradient(135deg, rgba(13,148,136,0.08), rgba(225,112,85,0.08))",
              border: "1px solid rgba(13,148,136,0.12)",
            }}>
              🏠
            </div>
            <h2 className="text-xl font-bold heading-tight mb-3">No properties yet</h2>
            <p className="text-sm max-w-md mx-auto mb-8" style={{ color: "var(--ds-text-secondary)", lineHeight: "1.7" }}>
              Tokenize your first property to create an NFT deed, share tokens, and a verifiable audit trail — all on Hedera.
            </p>
            <Link
              href="/dashboard/new"
              className="inline-flex text-white font-semibold px-8 py-3.5 rounded-[10px] text-[14px] transition-all hover:translate-y-[-2px]"
              style={{
                background: "linear-gradient(135deg, #0D9488, #e17055)",
                boxShadow: "0 4px 14px rgba(13,148,136,0.3), 0 1px 3px rgba(13,148,136,0.2)",
              }}
            >
              Tokenize Your First Property
            </Link>
            <p className="text-[11px] mt-4" style={{ color: "var(--ds-muted)" }}>
              ~$0.01 in Hedera fees · Takes about 10 seconds
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {properties.map((p, i) => (
            <Link
              key={p.id}
              href={`/dashboard/property/${p.id}`}
              className="glass rounded-[16px] p-6 group animate-fade-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold title-tight group-hover:text-ds-accent-text transition">{p.name}</h3>
                  {p.address && <p className="text-[11px] mt-0.5" style={{ color: "var(--ds-muted)" }}>{p.address}</p>}
                </div>
                {statusBadge(p.status)}
              </div>

              {/* Valuation */}
              <div className="flex items-baseline gap-1.5 mb-4">
                <span className="text-2xl font-bold heading-tight">${p.valuation_usd.toLocaleString()}</span>
                <span className="text-[11px]" style={{ color: "var(--ds-muted)" }}>
                  ${Math.round(p.valuation_usd / p.total_slices)}/slice
                </span>
              </div>

              {/* On-chain IDs */}
              <div className="space-y-2 text-[12px]">
                {p.nft_token_id && (
                  <div className="flex items-center justify-between" style={{ color: "var(--ds-muted)" }}>
                    <span>📜 NFT Deed</span>
                    <span className="font-mono" style={{ color: "var(--ds-text)" }}>{p.nft_token_id}</span>
                  </div>
                )}
                {p.share_token_id && (
                  <div className="flex items-center justify-between" style={{ color: "var(--ds-muted)" }}>
                    <span>🪙 Shares</span>
                    <span className="font-mono" style={{ color: "var(--ds-text)" }}>{p.share_token_symbol} ({p.total_slices.toLocaleString()})</span>
                  </div>
                )}
                {p.audit_topic_id && (
                  <div className="flex items-center justify-between" style={{ color: "var(--ds-muted)" }}>
                    <span>📋 Audit</span>
                    <span className="font-mono" style={{ color: "var(--ds-text)" }}>{p.audit_topic_id}</span>
                  </div>
                )}
              </div>

              {/* Network badge */}
              <div className="mt-4 pt-3 border-t flex items-center gap-2 text-[10px]" style={{ borderColor: "var(--ds-border)", color: "var(--ds-muted)" }}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.network === "mainnet" ? "bg-ds-green" : "bg-yellow-400"}`} />
                {p.network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"}
                {p.deployed_at && ` · ${new Date(p.deployed_at).toLocaleDateString()}`}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
