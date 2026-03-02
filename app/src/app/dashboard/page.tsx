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
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.draft}`}>
        {status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Properties</h1>
          <p className="text-ds-muted text-sm mt-1">Manage your tokenized real estate assets</p>
        </div>
        <Link
          href="/dashboard/new"
          className="bg-gradient-to-r from-ds-accent to-ds-orange text-white font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition text-sm"
        >
          + Tokenize Property
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏠</div>
          <h2 className="text-xl font-semibold mb-2">No properties yet</h2>
          <p className="text-ds-muted text-sm mb-6">
            Tokenize your first property to create an NFT deed, share tokens, and a verifiable audit trail — all on Hedera.
          </p>
          <Link
            href="/dashboard/new"
            className="inline-flex bg-gradient-to-r from-ds-accent to-ds-orange text-white font-medium px-6 py-3 rounded-lg hover:opacity-90 transition text-sm"
          >
            Tokenize Your First Property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/property/${p.id}`}
              className="glass rounded-2xl p-6 hover:border-ds-accent/30 transition group"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold group-hover:text-ds-accent-light transition">{p.name}</h3>
                  {p.address && <p className="text-xs text-ds-muted mt-0.5">{p.address}</p>}
                </div>
                {statusBadge(p.status)}
              </div>

              {/* Valuation */}
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-bold">${p.valuation_usd.toLocaleString()}</span>
                <span className="text-xs text-ds-muted">
                  ${Math.round(p.valuation_usd / p.total_slices)}/slice
                </span>
              </div>

              {/* On-chain IDs */}
              <div className="space-y-2 text-xs">
                {p.nft_token_id && (
                  <div className="flex items-center justify-between text-ds-muted">
                    <span>📜 NFT Deed</span>
                    <span className="font-mono text-ds-text">{p.nft_token_id}</span>
                  </div>
                )}
                {p.share_token_id && (
                  <div className="flex items-center justify-between text-ds-muted">
                    <span>🪙 Shares</span>
                    <span className="font-mono text-ds-text">{p.share_token_symbol} ({p.total_slices.toLocaleString()})</span>
                  </div>
                )}
                {p.audit_topic_id && (
                  <div className="flex items-center justify-between text-ds-muted">
                    <span>📋 Audit</span>
                    <span className="font-mono text-ds-text">{p.audit_topic_id}</span>
                  </div>
                )}
              </div>

              {/* Network badge */}
              <div className="mt-4 pt-3 border-t border-ds-border flex items-center gap-2 text-[10px] text-ds-muted">
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
