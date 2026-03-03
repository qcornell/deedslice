"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import type { Property, Investor, AuditEntry } from "@/types/database";

/**
 * Public Investor Dashboard — no auth required.
 * This is the shareable link operators give to their investors.
 * Only shows data for properties with status = 'live' (enforced by RLS).
 */
export default function InvestorViewPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      supabase.from("ds_properties").select("*").eq("id", id).eq("status", "live").single(),
      supabase.from("ds_investors").select("*").eq("property_id", id).order("percentage", { ascending: false }),
      supabase.from("ds_audit_entries").select("*").eq("property_id", id).order("created_at", { ascending: false }),
    ]).then(([propRes, invRes, auditRes]) => {
      if (propRes.error || !propRes.data) {
        setNotFound(true);
      } else {
        setProperty(propRes.data as any);
        setInvestors((invRes.data || []) as any);
        setAuditEntries((auditRes.data || []) as any);
      }
      setLoading(false);
    });
  }, [id]);

  const pieColors = ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675", "#55efc4"];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ds-bg">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ds-bg">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold mb-2">Property Not Found</h1>
          <p className="text-ds-muted text-sm">This property doesn't exist or isn't publicly available.</p>
        </div>
      </div>
    );
  }

  const pricePerSlice = Math.round(property.valuation_usd / property.total_slices);
  const network = property.network;

  return (
    <div className="min-h-screen bg-ds-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header / Branding */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ds-accent flex items-center justify-center text-white font-bold">
              DS
            </div>
            <div>
              <div className="text-xs text-ds-muted uppercase tracking-wider">Investor Dashboard</div>
              <div className="text-sm font-semibold">Powered by DeedSlice</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ds-green pulse-green" />
            <span className="text-xs text-ds-muted">{network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"}</span>
          </div>
        </div>

        {/* Property Header */}
        <div className="glass rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">{property.name}</h1>
              {property.address && <p className="text-ds-muted mt-1">{property.address}</p>}
              <div className="flex items-center gap-3 mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-ds-green/15 text-ds-green border-ds-green/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" /> Live
                </span>
                <span className="text-xs text-ds-muted capitalize">{property.property_type}</span>
                {property.deployed_at && (
                  <span className="text-xs text-ds-muted">
                    Deployed {new Date(property.deployed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">${property.valuation_usd.toLocaleString()}</div>
              <div className="text-sm text-ds-muted mt-1">
                {property.total_slices.toLocaleString()} slices · ${pricePerSlice}/slice
              </div>
            </div>
          </div>
        </div>

        {/* On-chain verification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <a
            href={`https://hashscan.io/${network}/token/${property.nft_token_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-4 hover:border-ds-accent/30 transition group"
          >
            <div className="text-xs text-ds-muted mb-2">📜 NFT Master Deed</div>
            <div className="font-mono text-sm text-ds-accent-text group-hover:underline">{property.nft_token_id}</div>
            <div className="text-[10px] text-ds-muted mt-1">Serial #{property.nft_serial} · Verify on HashScan →</div>
          </a>
          <a
            href={`https://hashscan.io/${network}/token/${property.share_token_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-4 hover:border-ds-accent/30 transition group"
          >
            <div className="text-xs text-ds-muted mb-2">🪙 Share Token</div>
            <div className="font-mono text-sm text-ds-accent-text group-hover:underline">{property.share_token_symbol}</div>
            <div className="text-[10px] text-ds-muted mt-1">{property.total_slices.toLocaleString()} total supply · Verify on HashScan →</div>
          </a>
          <a
            href={`https://hashscan.io/${network}/topic/${property.audit_topic_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="glass rounded-xl p-4 hover:border-ds-accent/30 transition group"
          >
            <div className="text-xs text-ds-muted mb-2">📋 Audit Trail</div>
            <div className="font-mono text-sm text-ds-accent-text group-hover:underline">{property.audit_topic_id}</div>
            <div className="text-[10px] text-ds-muted mt-1">{auditEntries.length} entries · Verify on HashScan →</div>
          </a>
        </div>

        {/* Ownership + Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ownership */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-5">Ownership Distribution</h2>
            <div className="space-y-4">
              {investors.map((inv, i) => (
                <div key={inv.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                      <span className="font-medium">{inv.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{inv.percentage}%</span>
                      <span className="text-xs text-ds-muted ml-2">{inv.slices_owned.toLocaleString()} slices</span>
                      <span className="text-xs text-ds-muted ml-2">(${(pricePerSlice * inv.slices_owned).toLocaleString()})</span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 bg-ds-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${inv.percentage}%`, backgroundColor: pieColors[i % pieColors.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-5">Audit Trail</h2>
            <p className="text-xs text-ds-muted mb-4">
              Every action is permanently recorded on Hedera Consensus Service. This log cannot be altered or deleted.
            </p>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="bg-ds-bg rounded-lg p-3 border border-ds-border/50">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-medium">{entry.action.replace(/_/g, " ")}</div>
                    <span className="text-[10px] text-ds-muted whitespace-nowrap ml-2">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                  {entry.details && <p className="text-xs text-ds-muted mt-1">{entry.details}</p>}
                  {entry.hcs_sequence != null && (
                    <div className="text-[10px] text-ds-accent-text font-mono mt-1">HCS #{entry.hcs_sequence}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 pb-8">
          <p className="text-xs text-ds-muted">
            Ownership verified on Hedera Hashgraph — governed by Google, IBM, Boeing, FedEx & more.
          </p>
          <p className="text-xs text-ds-muted/60 mt-1">
            Powered by <a href="https://deedslice.com" className="text-ds-accent-text hover:underline">DeedSlice</a> · Infrastructure for tokenized real estate
          </p>
        </div>
      </div>
    </div>
  );
}
