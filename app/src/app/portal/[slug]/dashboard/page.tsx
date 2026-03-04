"use client";

/**
 * LP Portal — Dashboard
 *
 * Institutional-grade investor dashboard.
 * Clean, calm, financial. No confetti. No animations.
 * Data-dense but uncluttered.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PortfolioSummary {
  totalValue: number;
  propertyCount: number;
  totalDistributions: number;
}

interface PropertyCard {
  propertyId: string;
  name: string;
  address: string | null;
  propertyType: string;
  imageUrl: string | null;
  status: string;
  valuation: number;
  totalSlices: number;
  mySlices: number;
  myPercentage: number;
  myValue: number;
  pricePerSlice: number;
  shareTokenSymbol: string | null;
  transferStatus: string | null;
  kycStatus: string;
  deployedAt: string | null;
}

interface Distribution {
  id: string;
  property_id: string;
  amount_usd: number;
  type: string;
  period: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action: string;
  details: string | null;
  created_at: string;
}

export default function LpDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "transactions" | "audit">("overview");
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(`lp_token_${slug}`);
    if (!token) { router.push(`/portal/${slug}`); return; }

    fetch("/api/lp/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) { localStorage.removeItem(`lp_token_${slug}`); router.push(`/portal/${slug}`); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setPortfolio(data.portfolio);
        setProperties(data.properties);
        setDistributions(data.distributions);
        setAuditEntries(data.auditEntries);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, router]);

  function handleLogout() {
    localStorage.removeItem(`lp_token_${slug}`);
    router.push(`/portal/${slug}`);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  const currentProp = selectedProperty ? properties.find(p => p.propertyId === selectedProperty) : null;

  return (
    <div>
      {/* Portfolio Summary — always visible */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold" style={{ color: "var(--lp-text, #0F172A)" }}>Portfolio</h1>
        <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition">Sign Out</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Portfolio Value" value={`$${(portfolio?.totalValue || 0).toLocaleString()}`} />
        <StatCard label="Properties" value={String(portfolio?.propertyCount || 0)} />
        <StatCard label="Distributions" value={`$${(portfolio?.totalDistributions || 0).toLocaleString()}`} />
        <StatCard label="Investments" value={`${properties.length}`} />
      </div>

      {/* Property Cards */}
      {!selectedProperty && (
        <div>
          <h2 className="text-sm font-medium mb-3" style={{ color: "#64748B" }}>Investments</h2>
          {properties.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm" style={{ color: "#94A3B8" }}>No investments yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {properties.map(p => (
                <button
                  key={p.propertyId}
                  onClick={() => setSelectedProperty(p.propertyId)}
                  className="bg-white rounded-xl border text-left p-4 transition hover:border-gray-300"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <div className="flex gap-3">
                    {p.imageUrl ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center text-xl shrink-0">🏠</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium truncate" style={{ color: "var(--lp-text)" }}>{p.name}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.address && <p className="text-xs mt-0.5 truncate" style={{ color: "#94A3B8" }}>{p.address}</p>}
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs" style={{ color: "#64748B" }}>
                          <strong style={{ color: "var(--lp-text)" }}>${p.myValue.toLocaleString()}</strong> invested
                        </span>
                        <span className="text-xs" style={{ color: "#64748B" }}>
                          <strong style={{ color: "var(--lp-text)" }}>{p.myPercentage}%</strong> ownership
                        </span>
                        <span className="text-xs" style={{ color: "#64748B" }}>
                          {p.mySlices.toLocaleString()} slices
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Property Detail View */}
      {selectedProperty && currentProp && (
        <PropertyDetail
          property={currentProp}
          distributions={distributions.filter(d => d.property_id === selectedProperty)}
          auditEntries={auditEntries.filter(e => true)} // All entries shown for now
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => { setSelectedProperty(null); setActiveTab("overview"); }}
        />
      )}
    </div>
  );
}

// ── Sub-Components ──────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#E5E7EB" }}>
      <div className="text-xs font-medium mb-1" style={{ color: "#94A3B8" }}>{label}</div>
      <div className="text-lg font-semibold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    live: { bg: "#F0FDF4", text: "#16A34A" },
    deploying: { bg: "#FFFBEB", text: "#D97706" },
    closed: { bg: "#F1F5F9", text: "#64748B" },
  };
  const c = colors[status] || colors.live;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: c.bg, color: c.text }}>
      {status === "live" && <span className="w-1 h-1 rounded-full" style={{ background: c.text }} />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PropertyDetail({
  property: p,
  distributions,
  auditEntries,
  activeTab,
  onTabChange,
  onBack,
}: {
  property: PropertyCard;
  distributions: Distribution[];
  auditEntries: AuditEntry[];
  activeTab: string;
  onTabChange: (tab: any) => void;
  onBack: () => void;
}) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "transactions", label: "Transactions" },
    { id: "audit", label: "Audit Trail" },
  ];

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="text-xs mb-4 transition" style={{ color: "#94A3B8" }}>
        ← Back to Portfolio
      </button>

      {/* Property Header */}
      <div className="bg-white rounded-xl border p-5 mb-4" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: "var(--lp-text)" }}>{p.name}</h2>
              <StatusBadge status={p.status} />
            </div>
            {p.address && <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{p.address}</p>}
            <p className="text-xs mt-0.5 capitalize" style={{ color: "#94A3B8" }}>{p.propertyType}</p>
          </div>
          <div className="md:text-right">
            <div className="text-2xl font-semibold" style={{ color: "var(--lp-text)", letterSpacing: "-0.02em" }}>${p.myValue.toLocaleString()}</div>
            <div className="text-xs" style={{ color: "#94A3B8" }}>{p.myPercentage}% · {p.mySlices.toLocaleString()} slices · ${p.pricePerSlice}/slice</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4" style={{ borderColor: "#E5E7EB" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="px-4 py-2.5 text-xs font-medium transition"
            style={{
              color: activeTab === tab.id ? "var(--lp-primary, #0D9488)" : "#94A3B8",
              borderBottom: activeTab === tab.id ? `2px solid var(--lp-primary, #0D9488)` : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Your Investment" value={`$${p.myValue.toLocaleString()}`} />
          <StatCard label="Ownership" value={`${p.myPercentage}%`} />
          <StatCard label="Property Value" value={`$${p.valuation.toLocaleString()}`} />
          <StatCard label="Total Slices" value={p.totalSlices.toLocaleString()} />
          <div className="col-span-2 md:col-span-4 bg-white rounded-xl border p-4" style={{ borderColor: "#E5E7EB" }}>
            <div className="text-xs font-medium mb-3" style={{ color: "#94A3B8" }}>On-Chain Tokens</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between" style={{ color: "#64748B" }}>
                <span>Share Token</span>
                <span className="font-mono" style={{ color: "var(--lp-text)" }}>{p.shareTokenSymbol || "—"}</span>
              </div>
              <div className="flex justify-between" style={{ color: "#64748B" }}>
                <span>Transfer Status</span>
                <span style={{ color: p.transferStatus === "transferred" ? "#16A34A" : "#94A3B8" }}>
                  {p.transferStatus === "transferred" ? "✓ On-chain" : p.transferStatus || "Pending"}
                </span>
              </div>
              <div className="flex justify-between" style={{ color: "#64748B" }}>
                <span>KYC Status</span>
                <span style={{ color: p.kycStatus === "verified" ? "#16A34A" : p.kycStatus === "rejected" ? "#EF4444" : "#94A3B8" }}>
                  {p.kycStatus === "verified" ? "✓ Verified" : p.kycStatus?.charAt(0).toUpperCase() + p.kycStatus?.slice(1) || "Unverified"}
                </span>
              </div>
              <div className="flex justify-between" style={{ color: "#64748B" }}>
                <span>Deployed</span>
                <span style={{ color: "var(--lp-text)" }}>{p.deployedAt ? new Date(p.deployedAt).toLocaleDateString() : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="bg-white rounded-xl border p-4" style={{ borderColor: "#E5E7EB" }}>
          <p className="text-xs" style={{ color: "#94A3B8" }}>Documents shared by your operator will appear here.</p>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="bg-white rounded-xl border" style={{ borderColor: "#E5E7EB" }}>
          {distributions.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs" style={{ color: "#94A3B8" }}>No transactions yet.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {distributions.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium" style={{ color: "var(--lp-text)" }}>
                      {d.type === "distribution" ? "Distribution" : d.type}
                    </div>
                    <div className="text-xs" style={{ color: "#94A3B8" }}>{d.period || new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium" style={{ color: "#16A34A" }}>+${Number(d.amount_usd).toLocaleString()}</div>
                    <div className="text-[10px]" style={{ color: d.status === "paid" ? "#16A34A" : "#94A3B8" }}>
                      {d.status === "paid" ? "Paid" : "Pending"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white rounded-xl border" style={{ borderColor: "#E5E7EB" }}>
          {auditEntries.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-xs" style={{ color: "#94A3B8" }}>No audit entries.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "#F1F5F9" }}>
              {auditEntries.map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-xs font-medium" style={{ color: "var(--lp-text)" }}>{e.action.replace(/_/g, " ")}</div>
                    {e.details && <div className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>{e.details}</div>}
                  </div>
                  <div className="text-[10px] shrink-0 ml-3" style={{ color: "#94A3B8" }}>
                    {new Date(e.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
