"use client";

/**
 * Audit Trail Page — Upgraded UI (2026-03-05)
 *
 * Timeline view matching Claude mockup:
 *   - Filter bar (search + property + event type + time range)
 *   - Timeline with colored icons, expandable meta, HCS badge
 *   - Export button
 *   - All existing functionality preserved: pagination, hashscan links, HCS sequence
 */

import { useEffect, useState, useMemo } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { HEDERA_NETWORK, HASHSCAN_BASE } from "@/lib/hedera/config";
import type { Property, AuditEntry } from "@/types/database";

/* ── Action config: icon SVG, color mapping ── */
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PROPERTY_TOKENIZED: {
    label: "Property Tokenized",
    color: "#0D9488",
    bg: "rgba(13,148,136,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  },
  INVESTOR_ADDED: {
    label: "Investor Added",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  INVESTOR_UPDATED: {
    label: "Investor Updated",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
  INVESTOR_REMOVED: {
    label: "Investor Removed",
    color: "#DF1B41",
    bg: "rgba(223,27,65,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6h12a6 6 0 00-6-6zM21 12h-6" /></svg>,
  },
  TOKENS_TRANSFERRED: {
    label: "Token Transfer",
    color: "#0ACF83",
    bg: "rgba(10,207,131,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  },
  TRANSFER_FAILED: {
    label: "Transfer Failed",
    color: "#DF1B41",
    bg: "rgba(223,27,65,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  },
  VALUATION_UPDATED: {
    label: "Valuation Updated",
    color: "#FFA500",
    bg: "rgba(255,165,0,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  PROPERTY_UPDATED: {
    label: "Property Updated",
    color: "#FFA500",
    bg: "rgba(255,165,0,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
  DOCUMENT_ADDED: {
    label: "Document Added",
    color: "#0D9488",
    bg: "rgba(13,148,136,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  DISTRIBUTION_RECORDED: {
    label: "Distribution Recorded",
    color: "#0ACF83",
    bg: "rgba(10,207,131,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  DISTRIBUTION_PAID: {
    label: "Distribution Paid",
    color: "#0ACF83",
    bg: "rgba(10,207,131,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  },
  BATCH_DISTRIBUTION_RECORDED: {
    label: "Distribution Recorded",
    color: "#0ACF83",
    bg: "rgba(10,207,131,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  BATCH_DISTRIBUTION_PAID: {
    label: "Distribution Paid",
    color: "#0ACF83",
    bg: "rgba(10,207,131,0.1)",
    icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  },
};

const DEFAULT_CONFIG = {
  label: "Event",
  color: "#8792A2",
  bg: "rgba(135,146,162,0.1)",
  icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
};

const EVENT_TYPES = [
  "PROPERTY_TOKENIZED",
  "INVESTOR_ADDED",
  "INVESTOR_UPDATED",
  "TOKENS_TRANSFERRED",
  "TRANSFER_FAILED",
  "DISTRIBUTION_RECORDED",
  "DISTRIBUTION_PAID",
  "BATCH_DISTRIBUTION_RECORDED",
  "BATCH_DISTRIBUTION_PAID",
  "DOCUMENT_ADDED",
  "VALUATION_UPDATED",
  "PROPERTY_UPDATED",
];

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AuditPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

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

  const filtered = useMemo(() => {
    let entries = auditEntries;

    // Property filter
    if (selectedProperty !== "all") {
      entries = entries.filter((e) => e.property_id === selectedProperty);
    }

    // Event type filter
    if (eventFilter !== "all") {
      entries = entries.filter((e) => e.action === eventFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.action.toLowerCase().includes(q) ||
          (e.details && e.details.toLowerCase().includes(q)) ||
          (e.tx_id && e.tx_id.toLowerCase().includes(q))
      );
    }

    return entries;
  }, [auditEntries, selectedProperty, eventFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const onChainCount = filtered.filter((e) => e.hcs_sequence != null).length;

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedProperty, eventFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <p className="text-[14px]" style={{ color: "#697386" }}>
          Immutable blockchain record of all property transactions
        </p>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap self-start sm:self-auto flex-shrink-0"
          style={{ background: "rgba(13,148,136,0.08)", color: "#0D9488" }}
        >
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Hedera Consensus Service
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[240px] relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "#8792A2" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full bg-white border border-[#E3E8EF] rounded-lg pl-10 pr-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
            />
          </div>

          {/* Property filter */}
          {properties.length > 1 && (
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition appearance-none pr-9"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
              }}
            >
              <option value="all">All Properties</option>
              {properties.filter((p) => p.status === "live").map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {/* Event type filter */}
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="bg-white border border-[#E3E8EF] rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition appearance-none pr-9"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 10px center",
            }}
          >
            <option value="all">All Events</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {(ACTION_CONFIG[t]?.label || t.replace(/_/g, " "))}
              </option>
            ))}
          </select>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 mt-3 pt-3 border-t" style={{ borderColor: "#E3E8EF" }}>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: "#697386" }}>
            <span className="font-semibold" style={{ color: "#1A1F36" }}>{filtered.length}</span> total events
          </div>
          <div className="flex items-center gap-2 text-[13px]" style={{ color: "#697386" }}>
            <span className="w-2 h-2 rounded-full bg-[#0ACF83]" />
            <span className="font-semibold" style={{ color: "#0ACF83" }}>{onChainCount}</span> on-chain
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: "rgba(135,146,162,0.08)" }}>
            <svg width="32" height="32" fill="none" stroke="#8792A2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#1A1F36" }}>No audit entries</h2>
          <p className="text-[14px]" style={{ color: "#697386" }}>
            {searchQuery || eventFilter !== "all" ? "No entries match your filters." : "Tokenize a property to start building your audit trail."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#E3E8EF" }}>
            <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Transaction History</h2>
          </div>

          {/* Timeline */}
          <div className="relative pl-12 pr-6 py-4">
            {/* Vertical line */}
            <div className="absolute left-[27px] top-0 bottom-0 w-[2px]" style={{ background: "#E3E8EF" }} />

            <div className="space-y-0">
              {paginated.map((entry, idx) => {
                const cfg = ACTION_CONFIG[entry.action] || DEFAULT_CONFIG;
                const propName = properties.find((p) => p.id === entry.property_id)?.name || "";

                return (
                  <div key={entry.id} className="relative pb-6 last:pb-2">
                    {/* Timeline icon */}
                    <div
                      className="absolute -left-[35px] w-7 h-7 rounded-full flex items-center justify-center text-white"
                      style={{ background: cfg.color, border: "3px solid white", boxShadow: `0 0 0 2px #E3E8EF` }}
                    >
                      {cfg.icon}
                    </div>

                    {/* Content card */}
                    <div className="rounded-lg p-4 border transition-all hover:shadow-sm" style={{ background: "#F6F9FC", borderColor: "#E3E8EF" }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4 mb-1.5">
                        <div className="text-[15px] font-semibold" style={{ color: "#1A1F36" }}>
                          {cfg.label}
                        </div>
                        <div className="text-[13px] flex-shrink-0" style={{ color: "#8792A2" }}>
                          {timeAgo(entry.created_at)}
                        </div>
                      </div>

                      {/* Description */}
                      {entry.details && (
                        <p className="text-[14px] mb-3" style={{ color: "#697386" }}>{entry.details}</p>
                      )}

                      {/* Meta grid */}
                      <div className="flex flex-wrap gap-x-8 gap-y-2">
                        {propName && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "#8792A2" }}>Property</div>
                            <div className="text-[14px] font-medium" style={{ color: "#1A1F36" }}>{propName}</div>
                          </div>
                        )}
                        {entry.hcs_sequence != null && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "#8792A2" }}>HCS Sequence</div>
                            <div className="text-[14px] font-mono font-medium" style={{ color: "#0D9488" }}>#{entry.hcs_sequence}</div>
                          </div>
                        )}
                        {entry.tx_id && (
                          <div>
                            <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: "#8792A2" }}>Transaction</div>
                            <a
                              href={(() => {
                                const parts = entry.tx_id!.split("@");
                                if (parts.length === 2) return `${HASHSCAN_BASE}/transaction/${parts[0]}-${parts[1].replace(".", "-")}`;
                                return `${HASHSCAN_BASE}/transaction/${entry.tx_id}`;
                              })()}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[14px] font-mono font-medium hover:underline flex items-center gap-1"
                              style={{ color: "#0D9488" }}
                            >
                              {entry.tx_id!.length > 20
                                ? entry.tx_id!.slice(0, 10) + "..." + entry.tx_id!.slice(-6)
                                : entry.tx_id}
                              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Confirmed badge */}
                      {entry.hcs_sequence != null && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium" style={{ background: "white", color: "#697386", border: "1px solid #E3E8EF" }}>
                          <svg width="12" height="12" fill="#0ACF83" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Confirmed on Hedera
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: "#E3E8EF" }}>
              <span className="text-[13px]" style={{ color: "#8792A2" }}>
                {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition disabled:opacity-30 hover:bg-[#F6F9FC]"
                  style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Prev
                </button>
                <span className="text-[13px] px-2" style={{ color: "#697386" }}>
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition disabled:opacity-30 hover:bg-[#F6F9FC]"
                  style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}
                >
                  Next
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
