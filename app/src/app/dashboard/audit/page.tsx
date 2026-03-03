"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import type { Property, AuditEntry } from "@/types/database";

export default function AuditPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("all");
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/properties", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then(async (d) => {
        const props: Property[] = d.properties || [];
        setProperties(props);

        // Load all audit entries across all properties
        const allEntries: AuditEntry[] = [];
        for (const p of props.filter((p) => p.status === "live")) {
          const res = await fetch(`/api/properties/${p.id}`, { headers: getAuthHeaders(session) });
          const data = await res.json();
          if (data.auditEntries) {
            allEntries.push(...data.auditEntries.map((e: AuditEntry) => ({ ...e, _propertyName: p.name })));
          }
        }
        allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setAuditEntries(allEntries);
        setLoading(false);
      });
  }, [session]);

  const filtered = selectedProperty === "all"
    ? auditEntries
    : auditEntries.filter((e) => e.property_id === selectedProperty);

  const actionColors: Record<string, string> = {
    PROPERTY_TOKENIZED: "text-ds-green",
    INVESTOR_ADDED: "text-ds-accent-text",
    INVESTOR_REMOVED: "text-ds-red",
    VALUATION_UPDATED: "text-yellow-400",
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
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Audit Trail</h1>
          <p className="text-ds-muted text-sm mt-1">
            Every action is permanently recorded on Hedera Consensus Service
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-ds-muted">
          <span className="w-2 h-2 rounded-full bg-ds-green pulse-green" />
          Tamper-proof
        </div>
      </div>

      {/* Filter */}
      {properties.length > 1 && (
        <div className="mb-6">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
          >
            <option value="all">All Properties</option>
            {properties.filter((p) => p.status === "live").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold mb-2">No audit entries</h2>
          <p className="text-ds-muted text-sm">Tokenize a property to start building your audit trail.</p>
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
                        href={`https://hashscan.io/testnet/transaction/${entry.tx_id.replace(/@/g, "-").replace(/\./g, "-")}`}
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
