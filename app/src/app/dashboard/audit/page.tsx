"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { HEDERA_NETWORK, HASHSCAN_BASE } from "@/lib/hedera/config";
import type { Property, AuditEntry } from "@/types/database";

export default function AuditPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

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

  const actionColors: Record<string, string> = {
    PROPERTY_TOKENIZED: "text-ds-green",
    INVESTOR_ADDED: "text-ds-accent-text",
    INVESTOR_UPDATED: "text-ds-accent-text",
    INVESTOR_REMOVED: "text-ds-red",
    TOKENS_TRANSFERRED: "text-ds-green",
    TRANSFER_FAILED: "text-ds-red",
    VALUATION_UPDATED: "text-yellow-400",
    PROPERTY_UPDATED: "text-yellow-400",
    DOCUMENT_ADDED: "text-ds-orange",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>
            Every action is permanently recorded on Hedera Consensus Service
          </p>
        </div>
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ds-muted)" }}>
          <span className="w-2 h-2 rounded-full bg-[#0ACF83]" />
          Tamper-proof
        </div>
      </div>

      {/* Filter */}
      {properties.length > 1 && (
        <div className="glass rounded-xl p-4 mb-6">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="w-full sm:w-auto bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[15px] font-medium focus:outline-none focus:border-[#0D9488] transition appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "40px" }}
          >
            <option value="all">All Properties</option>
            {properties.filter((p) => p.status === "live").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ds-text)" }}>No audit entries</h2>
          <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Tokenize a property to start building your audit trail.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const color = actionColors[entry.action] || "text-ds-text";
            const propName = (entry as any)._propertyName || properties.find((p) => p.id === entry.property_id)?.name || "";

            return (
              <div key={entry.id} className="glass rounded-xl p-4 hover:border-ds-accent/20 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`font-medium text-sm ${color}`}>
                        {entry.action.replace(/_/g, " ")}
                      </span>
                      {propName && (
                        <span className="text-[10px] text-ds-muted bg-ds-bg px-2 py-0.5 rounded-full">
                          {propName}
                        </span>
                      )}
                    </div>
                    {entry.details && (
                      <p className="text-xs text-ds-muted">{entry.details}</p>
                    )}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <div className="text-[10px] text-ds-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                    {entry.hcs_sequence != null && (
                      <div className="text-[10px] text-ds-accent-text font-mono mt-0.5">
                        HCS #{entry.hcs_sequence}
                      </div>
                    )}
                    {entry.tx_id && (
                      <a
                        href={(() => {
                          // Format: "0.0.XXXXXX@seconds.nanos" → "0.0.XXXXXX-seconds-nanos"
                          const parts = entry.tx_id.split("@");
                          if (parts.length === 2) {
                            const acct = parts[0]; // keep dots in account ID
                            const ts = parts[1].replace(".", "-");
                            return `${HASHSCAN_BASE}/transaction/${acct}-${ts}`;
                          }
                          return `${HASHSCAN_BASE}/transaction/${entry.tx_id}`;
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-ds-accent-text hover:underline font-mono"
                      >
                        View Tx →
                      </a>
                    )}
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
