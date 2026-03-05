"use client";

/**
 * Distributions Page — Overview of all distributions across all properties.
 *
 * Provides:
 *   - Property selector (like Investors page)
 *   - DistributionManager component for each selected property
 *   - Global summary stats
 */

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import type { Property, Investor } from "@/types/database";
import DistributionManager from "@/components/DistributionManager";

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
      .then(r => r.json())
      .then(d => {
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
      .then(r => r.json())
      .then(d => setInvestors(d.investors || []));
  }, [session, selectedProperty]);

  const currentProperty = properties.find(p => p.id === selectedProperty);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Record and track income distributions to investors</p>
      </div>

      {properties.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <div className="text-5xl mb-4">💰</div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--ds-text)" }}>No live properties</h2>
          <p className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Tokenize a property and add investors first.</p>
        </div>
      ) : (
        <>
          {/* Property selector bar */}
          <div className="glass rounded-xl p-4 mb-6">
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value)}
              className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[15px] font-medium focus:outline-none focus:border-[#0D9488] transition appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "40px" }}
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} – ${p.valuation_usd.toLocaleString()} Property
                </option>
              ))}
            </select>
          </div>

          {/* Distribution manager for selected property */}
          {currentProperty && (
            <DistributionManager
              session={session}
              property={currentProperty}
              investors={investors}
            />
          )}
        </>
      )}
    </div>
  );
}
