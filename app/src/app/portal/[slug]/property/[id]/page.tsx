"use client";

/**
 * LP Portal — Property Detail Page
 *
 * Deep-linkable property view: /portal/[slug]/property/[id]
 *
 * Shows a single property investment with:
 *   - Overview: investment stats, on-chain details, KYC widget
 *   - Documents: uploaded by operator, SHA-256 verified, downloadable
 *   - Transactions: distribution history + on-chain TX links
 *   - Audit Trail: HCS-anchored activity log
 *
 * Same institutional design as the dashboard.
 * This page is shareable — an operator can send an investor
 * a direct link to their specific property.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import StatCard from "@/components/lp/StatCard";
import StatusBadge from "@/components/lp/StatusBadge";
import DataTable, { Column } from "@/components/lp/DataTable";
import KycWidget from "@/components/lp/KycWidget";

// ── Types ─────────────────────────────────────────────────

interface PropertyDetail {
  propertyId: string;
  name: string;
  address: string | null;
  propertyType: string;
  imageUrl: string | null;
  description: string | null;
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
  totalDistributions: number;
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
}

// ── Main Component ────────────────────────────────────────

export default function PropertyDetailPage() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const router = useRouter();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "transactions" | "audit">("overview");

  useEffect(() => {
    const token = localStorage.getItem(`lp_token_${slug}`);
    if (!token) {
      router.push(`/portal/${slug}`);
      return;
    }

    fetch(`/api/lp/property?id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          localStorage.removeItem(`lp_token_${slug}`);
          router.push(`/portal/${slug}`);
          return null;
        }
        if (r.status === 404) {
          setError("Property not found in your portfolio.");
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setProperty(data.property);
        setDistributions(data.distributions || []);
        setAuditEntries(data.auditEntries || []);
        setDocuments(data.documents || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load property data.");
        setLoading(false);
      });
  }, [slug, id, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-lg mx-auto py-20 text-center">
        <div className="text-3xl mb-4 opacity-30">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>
          {error || "Property Not Found"}
        </h2>
        <p className="text-[13px] mb-6" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          This property may not exist or you may not have access to view it.
        </p>
        <button
          onClick={() => router.push(`/portal/${slug}/dashboard`)}
          className="text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white transition-all"
          style={{ background: "var(--lp-primary, #0D9488)", boxShadow: "0 1px 3px rgba(13,148,136,0.2)" }}
        >
          Back to Portfolio
        </button>
      </div>
    );
  }

  const hashscanBase = `https://hashscan.io/${property.network}`;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents", count: documents.length },
    { id: "transactions", label: "Transactions", count: distributions.length },
    { id: "audit", label: "Audit Trail", count: auditEntries.length },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back to portfolio */}
      <button
        onClick={() => router.push(`/portal/${slug}/dashboard`)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium mb-4 transition-colors"
        style={{ color: "var(--lp-text-muted, #94A3B8)" }}
        onMouseEnter={e => (e.currentTarget.style.color = "var(--lp-text-secondary, #64748B)")}
        onMouseLeave={e => (e.currentTarget.style.color = "var(--lp-text-muted, #94A3B8)")}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M8.5 3L4.5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Portfolio
      </button>

      {/* Property Header Card */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{ borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", background: "var(--lp-card-bg, #FFFFFF)" }}
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex gap-4">
            {property.imageUrl && (
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border hidden md:block" style={{ borderColor: "var(--lp-border-subtle, #F1F5F9)" }}>
                <img src={property.imageUrl} alt={property.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.01em" }}>
                  {property.name}
                </h1>
                <StatusBadge status={property.status} size="md" />
              </div>
              {property.address && (
                <p className="text-[12px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{property.address}</p>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[11px] capitalize" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
                  {property.propertyType}
                </span>
                {property.shareTokenSymbol && (
                  <>
                    <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>·</span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
                      {property.shareTokenSymbol}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="md:text-right">
            <div className="text-2xl font-bold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.02em" }}>
              ${property.myValue.toLocaleString()}
            </div>
            <div className="text-[12px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
              {property.myPercentage}% ownership · {property.mySlices.toLocaleString()} slices
            </div>
            {property.totalDistributions > 0 && (
              <div className="text-[11px] mt-1" style={{ color: "#16A34A" }}>
                +${property.totalDistributions.toLocaleString()} earned
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {property.description && (
          <p
            className="text-[12px] mt-4 pt-4 leading-relaxed"
            style={{ color: "var(--lp-text-secondary, #64748B)", borderTop: "1px solid var(--lp-border-subtle, #F1F5F9)" }}
          >
            {property.description}
          </p>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b mb-5" style={{ borderColor: "var(--lp-border, #E2E8F0)" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className="px-4 py-2.5 text-[12px] font-medium transition-colors relative"
            style={{
              color: activeTab === tab.id ? "var(--lp-primary, #0D9488)" : "var(--lp-text-muted, #94A3B8)",
            }}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md"
                style={{
                  background: activeTab === tab.id ? "rgba(13,148,136,0.08)" : "var(--lp-border-subtle, #F1F5F9)",
                  color: activeTab === tab.id ? "var(--lp-primary, #0D9488)" : "var(--lp-text-muted, #94A3B8)",
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
          {/* KYC Widget */}
          {property.kycStatus !== "verified" && (
            <KycWidget slug={slug} kycStatus={property.kycStatus || "unverified"} />
          )}

          {/* Investment Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Your Investment" value={`$${property.myValue.toLocaleString()}`} />
            <StatCard
              label="Ownership"
              value={`${property.myPercentage}%`}
              subtitle={`${property.mySlices.toLocaleString()} of ${property.totalSlices.toLocaleString()} slices`}
            />
            <StatCard label="Property Value" value={`$${property.valuation.toLocaleString()}`} />
            <StatCard label="Price / Slice" value={`$${property.pricePerSlice.toLocaleString()}`} />
          </div>

          {/* On-Chain Details */}
          <div
            className="rounded-xl border p-5"
            style={{ borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", background: "var(--lp-card-bg, #FFFFFF)" }}
          >
            <h3
              className="text-[11px] font-semibold tracking-wide uppercase mb-4"
              style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.06em" }}
            >
              On-Chain Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
              <DetailRow
                label="Share Token"
                value={property.shareTokenId || "—"}
                mono
                link={property.shareTokenId ? `${hashscanBase}/token/${property.shareTokenId}` : undefined}
              />
              <DetailRow label="Token Symbol" value={property.shareTokenSymbol || "—"} mono />
              <DetailRow
                label="NFT Deed"
                value={property.nftTokenId || "—"}
                mono
                link={property.nftTokenId ? `${hashscanBase}/token/${property.nftTokenId}` : undefined}
              />
              <DetailRow
                label="Audit Topic"
                value={property.auditTopicId || "—"}
                mono
                link={property.auditTopicId ? `${hashscanBase}/topic/${property.auditTopicId}` : undefined}
              />
              <DetailRow label="Transfer Status">
                <StatusBadge status={property.transferStatus || "pending"} />
              </DetailRow>
              <DetailRow label="KYC Status">
                <StatusBadge status={property.kycStatus || "unverified"} />
              </DetailRow>
              <DetailRow
                label="Network"
                value={property.network === "mainnet" ? "Hedera Mainnet" : "Hedera Testnet"}
              />
              <DetailRow
                label="Deployed"
                value={
                  property.deployedAt
                    ? new Date(property.deployedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                    : "—"
                }
              />
            </div>
            {property.transferTxId && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--lp-border-subtle, #F1F5F9)" }}>
                <DetailRow
                  label="Transfer TX"
                  value={property.transferTxId}
                  mono
                  link={`${hashscanBase}/transaction/${property.transferTxId}`}
                />
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
  const [downloading, setDownloading] = useState<string | null>(null);

  async function handleDownload(docId: string) {
    setDownloading(docId);
    try {
      const token = localStorage.getItem(`lp_token_${slug}`);
      if (!token) return;
      const res = await fetch(`/api/lp/documents/download?id=${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch {
      // Silent fail — user can retry
    } finally {
      setDownloading(null);
    }
  }

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
      width: "50px",
      render: (doc) => (
        <button
          onClick={() => handleDownload(doc.id)}
          disabled={downloading === doc.id}
          className="p-1.5 rounded-md transition-all hover:bg-[rgba(13,148,136,0.06)]"
          title="Download"
        >
          {downloading === doc.id ? (
            <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin inline-block" />
          ) : (
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--lp-primary, #0D9488)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
        </button>
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
        <span className="text-[13px] font-semibold" style={{ color: d.status === "paid" ? "#16A34A" : "var(--lp-text, #0F172A)" }}>
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
            <div className="text-[11px] mt-0.5 max-w-md truncate" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
              {e.details}
            </div>
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
        <span className="text-[12px] font-mono" style={{ color: e.hcs_sequence ? "var(--lp-text-secondary, #64748B)" : "var(--lp-text-muted, #CBD5E1)" }}>
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
