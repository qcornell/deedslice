"use client";

/**
 * LP Portal — Dashboard
 *
 * Institutional-grade investor dashboard.
 * Clean, calm, financial. No confetti. No animations.
 * Data-dense but uncluttered.
 *
 * Property detail has been extracted to /portal/[slug]/property/[id]
 * for deep-linkable, shareable property views.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import StatCard from "@/components/lp/StatCard";
import StatusBadge from "@/components/lp/StatusBadge";

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

// ── Main Component ────────────────────────────────────────

export default function LpDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [properties, setProperties] = useState<PropertyCard[]>([]);
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
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

      {/* ── Property List ── */}
      <PropertyList properties={properties} slug={slug} />
    </div>
  );
}

// ── Property List ─────────────────────────────────────────

function PropertyList({
  properties,
  slug,
}: {
  properties: PropertyCard[];
  slug: string;
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
        <span className="text-[11px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
          {properties.length} {properties.length === 1 ? "property" : "properties"}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {properties.map(p => (
          <Link
            key={p.propertyId}
            href={`/portal/${slug}/property/${p.propertyId}`}
            className="rounded-xl border text-left p-4 transition-all block"
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
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>{label}</div>
      <div className="text-[12px] font-semibold" style={{ color: "var(--lp-text, #0F172A)" }}>{value}</div>
    </div>
  );
}
