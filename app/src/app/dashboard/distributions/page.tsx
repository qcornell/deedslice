"use client";

/**
 * Distributions Page — Upgraded UI (2026-03-05)
 *
 * Two-column layout matching Claude mockup:
 *   Left: Stats → Distribution History (grouped by period, table format, avatars)
 *   Right: Action buttons sidebar
 *
 * Delegates recording logic to DistributionManager overlay.
 */

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";
import type { Property, Investor } from "@/types/database";
import dynamic from "next/dynamic";
const DistributionManager = dynamic(() => import("@/components/DistributionManager"));
import TaxReportGenerator from "@/components/TaxReportGenerator";

export default function DistributionsPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  // Load live properties
  useEffect(() => {
    if (!session) return;
    fetch("/api/properties", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => {
        const props = (d.properties || []).filter((p: Property) => p.status === "live");
        setProperties(props);
        if (props.length > 0) setSelectedProperty(props[0].id);
        setLoading(false);
      });
  }, [session]);

  // Load investors when property changes
  useEffect(() => {
    if (!session || !selectedProperty) return;
    fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setInvestors(d.investors || []));
  }, [session, selectedProperty]);

  const currentProperty = properties.find((p) => p.id === selectedProperty);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <p className="text-[14px]" style={{ color: "#697386" }}>
          Record and track income distributions to investors
        </p>
      </div>

      {properties.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(13,148,136,0.08)", border: "1px solid rgba(13,148,136,0.12)" }}
          >
            <svg width="32" height="32" fill="none" stroke="#0D9488" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#1A1F36" }}>No live properties</h2>
          <p className="text-[14px] mb-6" style={{ color: "#697386" }}>
            Tokenize a property and add investors first.
          </p>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 text-white font-medium px-6 py-3 rounded-lg text-[14px] transition-all hover:shadow-md"
            style={{ background: "#0ab4aa" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Tokenize Your First Property
          </Link>
        </div>
      ) : (
        <>
          {/* ── Property Selector ── */}
          <div className="glass rounded-xl p-4 flex items-center gap-3 mb-6">
            <select
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="flex-1 bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[15px] font-medium focus:outline-none focus:border-[#0D9488] transition appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: "40px",
              }}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} – ${p.valuation_usd.toLocaleString()} Property
                </option>
              ))}
            </select>
            {currentProperty && (
              <Link
                href={`/dashboard/property/${currentProperty.id}`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E3E8EF] bg-white text-[14px] font-medium transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC]"
                style={{ color: "#1A1F36" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="hidden sm:inline">View Property</span>
              </Link>
            )}
          </div>

          {/* Distribution manager for selected property */}
          {currentProperty && (
            <DistributionManager
              session={session}
              property={currentProperty}
              investors={investors}
            />
          )}

          {/* Tax Report Generator */}
          <div className="mt-6">
            <TaxReportGenerator
              properties={properties.map(p => ({ id: p.id, name: p.name }))}
              session={session}
            />
          </div>
        </>
      )}
    </div>
  );
}
