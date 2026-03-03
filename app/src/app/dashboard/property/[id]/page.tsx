"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import ImageUpload from "@/components/ImageUpload";
import { useParams } from "next/navigation";
import Link from "next/link";
import { HASHSCAN_BASE } from "@/lib/hedera/config";
import type { Property, Investor, AuditEntry } from "@/types/database";

function getTokenUrl(id: string, _network?: string) {
  return `${HASHSCAN_BASE}/token/${id}`;
}
function getTopicUrl(id: string, _network?: string) {
  return `${HASHSCAN_BASE}/topic/${id}`;
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !id) return;
    fetch(`/api/properties/${id}`, { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        setProperty(d.property);
        setInvestors(d.investors || []);
        setAuditEntries(d.auditEntries || []);
      })
      .finally(() => setLoading(false));
  }, [session, id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-2">Property not found</h2>
        <Link href="/dashboard" className="text-ds-accent-text hover:underline text-sm">
          ← Back to properties
        </Link>
      </div>
    );
  }

  const pricePerSlice = Math.round(property.valuation_usd / property.total_slices);

  // Ownership pie colors
  const pieColors = ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675", "#55efc4"];

  return (
    <div className="animate-fade-in">
      {/* Back link */}
      <Link href="/dashboard" className="text-ds-muted hover:text-ds-text text-sm mb-6 inline-block">
        ← All Properties
      </Link>

      {/* Property Image */}
      {property.image_url ? (
        <div className="rounded-2xl overflow-hidden mb-6 h-56 relative group">
          <img src={property.image_url} alt={property.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : (
        <div className="mb-6">
          <ImageUpload
            session={session}
            propertyId={id}
            currentUrl={null}
            onUploaded={(url) => setProperty((p) => p ? { ...p, image_url: url } : p)}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold heading-tight">{property.name}</h1>
          {property.address && <p className="text-ds-muted text-sm mt-0.5">{property.address}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
              property.status === "live"
                ? "bg-ds-green/15 text-ds-green border-ds-green/30"
                : "bg-ds-muted/15 text-ds-muted border-ds-muted/30"
            }`}>
              {property.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" />}
              {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
            </span>
            <span className="text-xs text-ds-muted">
              {property.network === "mainnet" ? "Mainnet" : "Testnet"}
            </span>
            <span className="text-xs text-ds-muted capitalize">
              · {property.property_type}
            </span>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-2xl sm:text-3xl font-bold">${property.valuation_usd.toLocaleString()}</div>
          <div className="text-xs text-ds-muted mt-1">${pricePerSlice}/slice · {property.total_slices.toLocaleString()} slices</div>
        </div>
      </div>

      {/* On-chain Assets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* NFT Deed */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>📜</span> NFT Master Deed
          </div>
          {property.nft_token_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Token ID</span>
                <a
                  href={getTokenUrl(property.nft_token_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.nft_token_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Serial</span>
                <span className="font-mono text-xs">#{property.nft_serial}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-ds-green">
                <span>✓</span> Minted
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>

        {/* Share Token */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>🪙</span> Share Tokens
          </div>
          {property.share_token_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Token ID</span>
                <a
                  href={getTokenUrl(property.share_token_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.share_token_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Symbol</span>
                <span className="font-mono text-xs">{property.share_token_symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Supply</span>
                <span className="font-mono text-xs">{property.total_slices.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>

        {/* Audit Trail */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-2 text-sm text-ds-muted mb-3">
            <span>📋</span> Audit Trail
          </div>
          {property.audit_topic_id ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Topic ID</span>
                <a
                  href={getTopicUrl(property.audit_topic_id, property.network)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-ds-accent-text hover:underline text-xs"
                >
                  {property.audit_topic_id}
                </a>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ds-muted text-xs">Entries</span>
                <span className="font-mono text-xs">{auditEntries.length}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-ds-green">
                <span>✓</span> Active
              </div>
            </div>
          ) : (
            <span className="text-xs text-ds-muted">Not deployed</span>
          )}
        </div>
      </div>

      {/* Two-column: Investors + Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ownership / Investors */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Ownership</h2>
            <span className="text-xs text-ds-muted">{investors.length} investor{investors.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Simple bar chart */}
          <div className="space-y-3 mb-5">
            {investors.map((inv, i) => (
              <div key={inv.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pieColors[i % pieColors.length] }}
                    />
                    <span>{inv.name}</span>
                  </div>
                  <span className="text-ds-muted text-xs">
                    {inv.slices_owned.toLocaleString()} slices · {inv.percentage}%
                  </span>
                </div>
                <div className="w-full h-2 bg-ds-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${inv.percentage}%`,
                      backgroundColor: pieColors[i % pieColors.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Value breakdown */}
          <div className="border-t border-ds-border pt-4 space-y-2 text-xs text-ds-muted">
            <div className="flex justify-between">
              <span>Total Valuation</span>
              <span className="text-ds-text">${property.valuation_usd.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Price Per Slice</span>
              <span className="text-ds-text">${pricePerSlice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Slices</span>
              <span className="text-ds-text">{property.total_slices.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Audit Trail</h2>
            <span className="text-xs text-ds-muted">
              Tamper-proof · Hedera Consensus Service
            </span>
          </div>

          {auditEntries.length === 0 ? (
            <p className="text-ds-muted text-sm">No audit entries yet.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="bg-ds-bg rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium">{entry.action}</div>
                      {entry.details && <p className="text-xs text-ds-muted mt-0.5">{entry.details}</p>}
                    </div>
                    <span className="text-[10px] text-ds-muted whitespace-nowrap ml-2">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.hcs_sequence && (
                    <div className="text-[10px] text-ds-muted mt-1 font-mono">
                      HCS seq #{entry.hcs_sequence}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shareable Investor Link (future) */}
      <div className="mt-8 glass rounded-2xl p-6 glow-border">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🔗</span>
          <div>
            <h2 className="font-semibold">Investor Dashboard Link</h2>
            <p className="text-xs text-ds-muted">Share a read-only view with your investors</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-xs sm:text-sm font-mono text-ds-muted truncate">
            console.deedslice.com/view/{id}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`https://console.deedslice.com/view/${id}`)}
            className="px-4 py-2.5 text-white rounded-[10px] text-sm font-medium transition-all hover:translate-y-[-1px] shrink-0"
            style={{ background: "#0D9488", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}
