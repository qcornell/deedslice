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
      <h1 className="text-2xl font-bold heading-tight mb-2">Distributions</h1>
      <p className="text-ds-muted text-sm mb-8">Record and track income distributions to investors</p>

      {properties.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">💰</div>
          <h2 className="text-xl font-semibold mb-2">No live properties</h2>
          <p className="text-ds-muted text-sm">Tokenize a property and add investors first.</p>
        </div>
      ) : (
        <>
          {/* Property selector */}
          <div className="mb-6">
            <select
              value={selectedProperty}
              onChange={e => setSelectedProperty(e.target.value)}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
            >
              {properties.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — ${p.valuation_usd.toLocaleString()} ({p.total_slices.toLocaleString()} slices)
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
