"use client";

/**
 * LP Portal — Dashboard
 *
 * Institutional-grade investor dashboard.
 * Clean, calm, financial. No confetti. No animations.
 * Data-dense but uncluttered.
 *
 * If a $10M syndicator logs in, they should not feel
 * embarrassed sharing this with investors.
 */

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import StatCard from "@/components/lp/StatCard";
import StatusBadge from "@/components/lp/StatusBadge";
import DataTable, { Column } from "@/components/lp/DataTable";
import KycWidget from "@/components/lp/KycWidget";

// ── Types ─────────────────────────────────────────────────

interface PortfolioSummary {
  totalValue: number;
  propertyCount: number;
  totalDistributions: number;
  ownershipSummary: { name: string; percentage: number; value: number }[];
}

interface PropertyCard {
  propertyId: string;
  name: string;
  address: string | null;
  propertyType: string;
  imageUrl: string | null;
  status: string;
  network: string;
  valuation: number;
  totalSlices: number;
  mySlices: number;
  myPercentage: number;
  myValue: number;
  pricePerSlice: number;
  shareTokenId: string | null;
  shareTokenSymbol: string | null;
  nftTokenId: string | null;
  auditTopicId: string | null;
  transferStatus: string | null;
  transferTxId: string | null;
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
  tx_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface AuditEntry {
  id: string;
  property_id: string;
  action: string;
  details: string | null;
  tx_id: string | null;
  hcs_sequence: number | null;
  created_at: string;
}

interface DocumentRecord {
  id: string;
  property_id: string;
  label: string;
  document_type: string;
  file_name: string;
  file_size: number;
  sha256_hash: string;
  created_at: string;
  download_url?: string;
}

// ── Main Component ────────────────────────────────────────

export default function LpDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "transactions" | "audit">("overview");
  const [lpName, setLpName] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(`lp_token_${slug}`);
    if (!token) { router.push(`/portal/${slug}`); return; }

    fetch("/api/lp/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem(`lp_token_${slug}`);
          router.push(`/portal/${slug}`);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setPortfolio(data.portfolio);
        setProperties(data.properties || []);
        setDistributions(data.distributions || []);
        setAuditEntries(data.auditEntries || []);
        setDocuments(data.documents || []);
        setLpName(data.lpName || null);
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
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  const currentProp = selectedProperty
    ? properties.find(p => p.propertyId === selectedProperty) ?? null
    : null;

  const totalInvested = properties.reduce((sum, p) => sum + p.myValue, 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Top bar: title + signout */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.01em" }}>
            Portfolio
          </h1>
          {lpName && (
            <p className="text-[12px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
              Welcome back, {lpName}
            </p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-colors"
          style={{ color: "var(--lp-text-muted, #94A3B8)", borderColor: "var(--lp-border, #E2E8F0)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--lp-text-muted, #CBD5E1)"; e.currentTarget.style.color = "var(--lp-text-secondary, #64748B)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--lp-border, #E2E8F0)"; e.currentTarget.style.color = "var(--lp-text-muted, #94A3B8)"; }}
        >
          Sign Out
        </button>
      </div>

      {/* ── Portfolio Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Portfolio Value" value={`$${(portfolio?.totalValue || 0).toLocaleString()}`} />
        <StatCard label="Total Invested" value={`$${totalInvested.toLocaleString()}`} />
        <StatCard label="Properties" value={String(portfolio?.propertyCount || 0)} />
        <StatCard
          label="Distributions"
          value={`$${(portfolio?.totalDistributions || 0).toLocaleString()}`}
          subtitle={distributions.length > 0 ? `${distributions.filter(d => d.status === "paid").length} payments` : undefined}
        />
      </div>

      {/* ── Property List or Detail ── */}
      {!selectedProperty ? (
        <PropertyList
          properties={properties}
          onSelect={id => { setSelectedProperty(id); setActiveTab("overview"); }}
        />
      ) : currentProp ? (
        <PropertyDetail
          property={currentProp}
          distributions={distributions.filter(d => d.property_id === selectedProperty)}
          auditEntries={auditEntries.filter(a => a.property_id === selectedProperty)}
          documents={documents.filter(d => d.property_id === selectedProperty)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onBack={() => { setSelectedProperty(null); setActiveTab("overview"); }}
          slug={slug}
          network={currentProp.network}
        />
      ) : null}
    </div>
  );
}

// ── Property List ─────────────────────────────────────────

function PropertyList({
  properties,
  onSelect,
}: {
  properties: PropertyCard[];
  onSelect: (id: string) => void;
}) {
  if (properties.length === 0) {
    return (
      <div
        className="rounded-xl border p-12 text-center"
        style={{ borderColor: "var(--lp-border, #E2E8F0)" }}
      >
        <div className="text-3xl mb-3 opacity-30">📂</div>
        <p className="text-[13px] font-medium" style={{ color: "var(--lp-text-secondary, #64748B)" }}>No investments yet</p>
        <p className="text-[12px] mt-1" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
          Your properties will appear here once your operator assigns them.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[13px] font-semibold" style={{ color: "var(--lp-text-secondary, #64748B)" }}>Investments</h2>
        <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{properties.length} {properties.length === 1 ? "property" : "properties"}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {properties.map(p => (
          <button
            key={p.propertyId}
            onClick={() => onSelect(p.propertyId)}
            className="rounded-xl border text-left p-4 transition-all"
            style={{ borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,0.04)"; }}
          >
            <div className="flex gap-3">
              {p.imageUrl ? (
                <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border" style={{ borderColor: "var(--lp-border-subtle, #F1F5F9)" }}>
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0 text-lg" style={{ background: "var(--lp-bg, #F8FAFC)" }}>
                  🏠
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-semibold truncate" style={{ color: "var(--lp-text, #0F172A)" }}>{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                {p.address && (
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{p.address}</p>
                )}
                <div className="flex items-center gap-4 mt-2.5">
                  <Metric label="Value" value={`$${p.myValue.toLocaleString()}`} />
                  <Metric label="Ownership" value={`${p.myPercentage}%`} />
                  <Metric label="Slices" value={p.mySlices.toLocaleString()} />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{label}</div>
      <div className="text-[12px] font-semibold" style={{ color: "var(--lp-text, #0F172A)" }}>{value}</div>
    </div>
  );
}

// ── Property Detail ───────────────────────────────────────

function PropertyDetail({
  property: p,
  distributions,
  auditEntries,
  documents,
  activeTab,
  onTabChange,
  onBack,
  slug,
  network,
}: {
  property: PropertyCard;
  distributions: Distribution[];
  auditEntries: AuditEntry[];
  documents: DocumentRecord[];
  activeTab: string;
  onTabChange: (tab: any) => void;
  onBack: () => void;
  slug: string;
  network: string;
}) {
  const hashscanBase = `https://hashscan.io/${network}`;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", count: documents.length },
    { id: "transactions", label: "Transactions", count: distributions.length },
    { id: "audit", label: "Audit Trail", count: auditEntries.length },
  ];

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-4 transition-colors"
        style={{ color: "var(--lp-text-muted, #94A3B8)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#64748B")}
        onMouseLeave={e => (e.currentTarget.style.color = "#94A3B8")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to Portfolio
      </button>

      {/* Property Header Card */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{ borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex gap-4">
            {p.imageUrl && (
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border hidden md:block" style={{ borderColor: "var(--lp-border-subtle, #F1F5F9)" }}>
                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold" style={{ color: "var(--lp-text)", letterSpacing: "-0.01em" }}>{p.name}</h2>
                <StatusBadge status={p.status} size="md" />
              </div>
              {p.address && <p className="text-[12px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{p.address}</p>}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] capitalize" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{p.propertyType}</span>
                {p.shareTokenSymbol && (
                  <>
                    <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>·</span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{p.shareTokenSymbol}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="md:text-right">
            <div className="text-2xl font-bold" style={{ color: "var(--lp-text)", letterSpacing: "-0.02em" }}>
              ${p.myValue.toLocaleString()}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
              {p.myPercentage}% ownership · {p.mySlices.toLocaleString()} slices
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b mb-5" style={{ borderColor: "var(--lp-border, #E2E8F0)" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="px-4 py-2.5 text-[12px] font-medium transition-colors relative"
            style={{
              color: activeTab === tab.id ? "var(--lp-primary, #0D9488)" : "#94A3B8",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md"
                style={{
                  background: activeTab === tab.id ? "rgba(13,148,136,0.08)" : "#F1F5F9",
                  color: activeTab === tab.id ? "var(--lp-primary, #0D9488)" : "#94A3B8",
                }}
              >
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{ background: "var(--lp-primary, #0D9488)" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* KYC Widget — show if not verified */}
          {p.kycStatus !== "verified" && (
            <KycWidget
              slug={slug}
              kycStatus={p.kycStatus || "unverified"}
              onComplete={() => {
                // Refresh will happen via webhook, but update UI optimistically
              }}
            />
          )}

          {/* Investment Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Your Investment" value={`$${p.myValue.toLocaleString()}`} />
            <StatCard label="Ownership" value={`${p.myPercentage}%`} subtitle={`${p.mySlices.toLocaleString()} of ${p.totalSlices.toLocaleString()} slices`} />
            <StatCard label="Property Value" value={`$${p.valuation.toLocaleString()}`} />
            <StatCard label="Price / Slice" value={`$${p.pricePerSlice.toLocaleString()}`} />
          </div>

          {/* On-Chain Details */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
          >
            <h3 className="text-[11px] font-semibold tracking-wide uppercase mb-4" style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.06em" }}>
              On-Chain Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
              <DetailRow label="Share Token" value={p.shareTokenId || "—"} mono link={p.shareTokenId ? `${hashscanBase}/token/${p.shareTokenId}` : undefined} />
              <DetailRow label="Token Symbol" value={p.shareTokenSymbol || "—"} mono />
              <DetailRow label="NFT Deed" value={p.nftTokenId || "—"} mono link={p.nftTokenId ? `${hashscanBase}/token/${p.nftTokenId}` : undefined} />
              <DetailRow label="Audit Topic" value={p.auditTopicId || "—"} mono link={p.auditTopicId ? `${hashscanBase}/topic/${p.auditTopicId}` : undefined} />
              <DetailRow label="Transfer Status">
                <StatusBadge status={p.transferStatus || "pending"} />
              </DetailRow>
              <DetailRow label="KYC Status">
                <StatusBadge status={p.kycStatus || "unverified"} />
              </DetailRow>
              <DetailRow label="Network" value={p.network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"} />
              <DetailRow label="Deployed" value={p.deployedAt ? new Date(p.deployedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"} />
            </div>
            {p.transferTxId && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F5F9" }}>
                <DetailRow label="Transfer TX" value={p.transferTxId} mono link={`${hashscanBase}/transaction/${p.transferTxId}`} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <DocumentsView documents={documents} slug={slug} />
      )}

      {/* ── Transactions Tab ── */}
      {activeTab === "transactions" && (
        <TransactionsView distributions={distributions} hashscanBase={hashscanBase} />
      )}

      {/* ── Audit Trail Tab ── */}
      {activeTab === "audit" && (
        <AuditView auditEntries={auditEntries} hashscanBase={hashscanBase} />
      )}
    </div>
  );
}

// ── Detail Row ────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono,
  link,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  link?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[12px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>{label}</span>
      {children || (
        link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[12px] transition-colors ${mono ? "font-mono" : ""}`}
            style={{ color: "var(--lp-primary, #0D9488)" }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}
          >
            {value && value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value}
            <span className="ml-1 text-[10px]">↗</span>
          </a>
        ) : (
          <span className={`text-[12px] ${mono ? "font-mono" : ""}`} style={{ color: "var(--lp-text, #0F172A)" }}>
            {value}
          </span>
        )
      )}
    </div>
  );
}

// ── Documents View ────────────────────────────────────────

function DocumentsView({ documents, slug }: { documents: DocumentRecord[]; slug: string }) {
  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const columns: Column<DocumentRecord>[] = [
    {
      key: "label",
      header: "Document",
      render: (doc) => (
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--lp-text, #0F172A)" }}>{doc.label}</div>
          <div className="text-[11px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{doc.file_name}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (doc) => (
        <span className="text-[12px] capitalize" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          {doc.document_type.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "date",
      header: "Uploaded",
      render: (doc) => (
        <span className="text-[12px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          {new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "hash",
      header: "Verified",
      align: "center",
      width: "80px",
      render: (doc) => (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md"
          style={{ background: "#F0FDF4", color: "#16A34A" }}
          title={`SHA-256: ${doc.sha256_hash}`}
        >
          ✓ Hash
        </span>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "right",
      width: "80px",
      render: (doc) => (
        <span className="text-[12px] font-mono" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
          {formatSize(doc.file_size)}
        </span>
      ),
    },
    {
      key: "download",
      header: "",
      align: "right",
      width: "40px",
      render: (doc) => (
        doc.download_url ? (
          <a
            href={doc.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] transition-colors"
            style={{ color: "var(--lp-primary, #0D9488)" }}
          >
            ↓
          </a>
        ) : <span style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>—</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={documents}
      keyExtractor={d => d.id}
      emptyMessage="No documents shared yet. Documents uploaded by your operator will appear here."
    />
  );
}

// ── Transactions View ─────────────────────────────────────

function TransactionsView({ distributions, hashscanBase }: { distributions: Distribution[]; hashscanBase: string }) {
  // Group: distributions (income), token transfers, capital contributions
  const columns: Column<Distribution>[] = [
    {
      key: "type",
      header: "Type",
      render: (d) => {
        const typeLabels: Record<string, string> = {
          distribution: "Distribution",
          return_of_capital: "Return of Capital",
          token_transfer: "Token Transfer",
          other: "Other",
        };
        return (
          <span className="text-[13px] font-medium" style={{ color: "var(--lp-text, #0F172A)" }}>
            {typeLabels[d.type] || d.type}
          </span>
        );
      },
    },
    {
      key: "period",
      header: "Period",
      render: (d) => (
        <span className="text-[12px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          {d.period || new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (d) => (
        <span className="text-[13px] font-semibold" style={{ color: d.status === "paid" ? "#16A34A" : "#0F172A" }}>
          {d.status === "paid" ? "+" : ""}${Number(d.amount_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "tx",
      header: "On-Chain",
      align: "right",
      width: "80px",
      render: (d) => d.tx_id ? (
        <a
          href={`${hashscanBase}/transaction/${d.tx_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono transition-colors"
          style={{ color: "var(--lp-primary, #0D9488)" }}
        >
          View ↗
        </a>
      ) : (
        <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>—</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={distributions}
      keyExtractor={d => d.id}
      emptyMessage="No transactions yet. Distributions and transfers will appear here."
    />
  );
}

// ── Audit Trail View ──────────────────────────────────────

function AuditView({ auditEntries, hashscanBase }: { auditEntries: AuditEntry[]; hashscanBase: string }) {
  const columns: Column<AuditEntry>[] = [
    {
      key: "date",
      header: "Date",
      width: "140px",
      render: (e) => (
        <span className="text-[12px] font-mono" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          <span className="ml-1.5 text-[10px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            {new Date(e.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (e) => (
        <div>
          <span className="text-[13px] font-medium capitalize" style={{ color: "var(--lp-text, #0F172A)" }}>
            {e.action.replace(/_/g, " ")}
          </span>
          {e.details && (
            <div className="text-[11px] mt-0.5 max-w-md truncate" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{e.details}</div>
          )}
        </div>
      ),
    },
    {
      key: "seq",
      header: "HCS #",
      align: "center",
      width: "80px",
      render: (e) => (
        <span className="text-[12px] font-mono" style={{ color: e.hcs_sequence ? "#64748B" : "#CBD5E1" }}>
          {e.hcs_sequence ?? "—"}
        </span>
      ),
    },
    {
      key: "tx",
      header: "TX",
      align: "right",
      width: "80px",
      render: (e) => e.tx_id ? (
        <a
          href={`${hashscanBase}/transaction/${e.tx_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-mono transition-colors"
          style={{ color: "var(--lp-primary, #0D9488)" }}
        >
          View ↗
        </a>
      ) : (
        <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>—</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={auditEntries}
      keyExtractor={e => e.id}
      emptyMessage="No audit entries. On-chain activity will appear here."
    />
  );
}
