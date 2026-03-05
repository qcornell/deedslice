"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { HEDERA_NETWORK, HASHSCAN_BASE } from "@/lib/hedera/config";
import type { Property, AuditEntry } from "@/types/database";

const ACTION_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  PROPERTY_TOKENIZED: { icon: "✓", bg: "rgba(10,207,131,0.1)", color: "#0ACF83" },
  INVESTOR_ADDED: { icon: "👤", bg: "rgba(59,130,246,0.1)", color: "#3B82F6" },
  INVESTOR_UPDATED: { icon: "✏", bg: "rgba(59,130,246,0.1)", color: "#3B82F6" },
  INVESTOR_REMOVED: { icon: "✗", bg: "rgba(223,27,65,0.1)", color: "#DF1B41" },
  TOKENS_TRANSFERRED: { icon: "✓", bg: "rgba(10,207,131,0.1)", color: "#0ACF83" },
  TRANSFER_FAILED: { icon: "✗", bg: "rgba(223,27,65,0.1)", color: "#DF1B41" },
  VALUATION_UPDATED: { icon: "$", bg: "rgba(255,165,0,0.1)", color: "#FFA500" },
  PROPERTY_UPDATED: { icon: "✏", bg: "rgba(255,165,0,0.1)", color: "#FFA500" },
  DOCUMENT_ADDED: { icon: "📄", bg: "rgba(13,148,136,0.1)", color: "#0D9488" },
  DISTRIBUTION_RECORDED: { icon: "💰", bg: "rgba(10,207,131,0.1)", color: "#0ACF83" },
  DISTRIBUTION_PAID: { icon: "✓", bg: "rgba(10,207,131,0.1)", color: "#0ACF83" },
};

const DEFAULT_ICON = { icon: "•", bg: "rgba(135,146,162,0.1)", color: "#8792A2" };

export default function AuditPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    if (!session) return;
    fetch("/api/audit/all", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        setProperties(d.properties || []);
        setAuditEntries(d.auditEntries || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session]);

  const filtered = selectedProperty === "all"
    ? auditEntries
    : auditEntries.filter((e) => e.property_id === selectedProperty);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>
          Every action is permanently recorded on Hedera Consensus Service
        </p>
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ds-muted)" }}>
          <span className="w-2 h-2 rounded-full bg-[#0ACF83]" />
          Tamper-proof
        </div>
      </div>

      {/* Filter + Stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {properties.length > 1 && (
          <div className="glass rounded-xl p-4 flex-1">
            <select
              value={selectedProperty}
              onChange={(e) => { setSelectedProperty(e.target.value); setPage(1); }}
              className="w-full bg-white border rounded-lg px-4 py-2.5 text-[15px] font-medium focus:outline-none focus:border-[#0D9488] transition appearance-none"
              style={{
                borderColor: "var(--ds-border)",
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: "40px",
              }}
            >
              <option value="all">All Properties</option>
              {properties.filter((p) => p.status === "live").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="glass rounded-xl p-4 flex items-center gap-6">
          <div className="text-center">
            <div className="text-[12px] uppercase tracking-wide font-medium" style={{ color: "var(--ds-muted)" }}>Total Events</div>
            <div className="text-[24px] font-bold" style={{ color: "var(--ds-text)" }}>{filtered.length}</div>
          </div>
          <div className="w-px h-10" style={{ background: "var(--ds-border)" }} />
          <div className="text-center">
            <div className="text-[12px] uppercase tracking-wide font-medium" style={{ color: "var(--ds-muted)" }}>On-chain</div>
            <div className="text-[24px] font-bold text-[#0ACF83]">{filtered.filter(e => e.hcs_sequence != null).length}</div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ds-text)" }}>No audit entries</h2>
          <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Tokenize a property to start building your audit trail.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[44px_1fr_200px_120px] gap-4 px-6 py-3 border-b text-[12px] uppercase tracking-wide font-semibold" style={{ borderColor: "var(--ds-border)", color: "var(--ds-muted)" }}>
            <div></div>
            <div>Event</div>
            <div>Property</div>
            <div className="text-right">Time</div>
          </div>

          {/* Entries */}
          <div className="divide-y" style={{ borderColor: "var(--ds-border)" }}>
            {paginated.map((entry) => {
              const iconCfg = ACTION_ICONS[entry.action] || DEFAULT_ICON;
              const propName = (entry as any)._propertyName || properties.find((p) => p.id === entry.property_id)?.name || "";

              return (
                <div key={entry.id} className="grid grid-cols-[44px_1fr_200px_120px] gap-4 px-6 py-4 items-center hover:bg-[#F6F9FC] transition-colors">
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0"
                    style={{ background: iconCfg.bg, color: iconCfg.color }}>
                    {iconCfg.icon}
                  </div>

                  {/* Event details */}
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium" style={{ color: iconCfg.color }}>
                      {entry.action.replace(/_/g, " ")}
                    </div>
                    {entry.details && (
                      <p className="text-[13px] truncate" style={{ color: "var(--ds-muted)" }}>{entry.details}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      {entry.hcs_sequence != null && (
                        <span className="text-[11px] font-mono text-[#0D9488]">HCS #{entry.hcs_sequence}</span>
                      )}
                      {entry.tx_id && (
                        <a
                          href={(() => {
                            const parts = entry.tx_id.split("@");
                            if (parts.length === 2) return `${HASHSCAN_BASE}/transaction/${parts[0]}-${parts[1].replace(".", "-")}`;
                            return `${HASHSCAN_BASE}/transaction/${entry.tx_id}`;
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#0D9488] hover:underline font-mono"
                        >
                          View Tx →
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Property */}
                  <div>
                    {propName && (
                      <span className="text-[13px] px-2.5 py-1 rounded-md" style={{ background: "var(--ds-bg)", color: "var(--ds-text-secondary)" }}>
                        {propName}
                      </span>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right">
                    <div className="text-[12px]" style={{ color: "var(--ds-muted)" }}>
                      {new Date(entry.created_at).toLocaleDateString()}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--ds-muted)" }}>
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: "var(--ds-border)" }}>
              <span className="text-[13px]" style={{ color: "var(--ds-muted)" }}>
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border text-[13px] transition disabled:opacity-30"
                  style={{ borderColor: "var(--ds-border)", color: "var(--ds-text)" }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border text-[13px] transition disabled:opacity-30"
                  style={{ borderColor: "var(--ds-border)", color: "var(--ds-text)" }}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
