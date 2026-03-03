"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import type { Property, Investor } from "@/types/database";

export default function InvestorsPage() {
  const { session } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);

  // Add investor form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [slices, setSlices] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load properties
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

  async function handleAddInvestor(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !selectedProperty) return;
    setError("");
    setSuccess("");
    setAdding(true);

    try {
      const res = await fetch("/api/investors", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          propertyId: selectedProperty,
          name,
          email: email || undefined,
          slicesOwned: Number(slices),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccess(`Added ${name} with ${slices} slices`);
      setName("");
      setEmail("");
      setSlices("");

      // Refresh investors
      const refreshRes = await fetch(`/api/properties/${selectedProperty}`, { headers: getAuthHeaders(session) });
      const refreshData = await refreshRes.json();
      setInvestors(refreshData.investors || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  }

  const pieColors = ["#6c5ce7", "#e17055", "#00b894", "#fdcb6e", "#74b9ff", "#a29bfe", "#ff7675", "#55efc4"];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold heading-tight mb-2">Investors</h1>
      <p className="text-ds-muted text-sm mb-8">Manage ownership distribution for your properties</p>

      {properties.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h2 className="text-xl font-semibold mb-2">No live properties</h2>
          <p className="text-ds-muted text-sm">Tokenize a property first to add investors.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Investor List */}
          <div>
            {/* Property selector */}
            <div className="mb-4">
              <select
                value={selectedProperty}
                onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.total_slices.toLocaleString()} slices)
                  </option>
                ))}
              </select>
            </div>

            {/* Current investors */}
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold mb-4">Current Ownership</h2>
              {investors.length === 0 ? (
                <p className="text-ds-muted text-sm">No investors added yet.</p>
              ) : (
                <div className="space-y-3">
                  {investors.map((inv, i) => (
                    <div key={inv.id} className="bg-ds-bg rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                          <span className="font-medium text-sm">{inv.name}</span>
                        </div>
                        <span className="font-semibold text-sm">{inv.percentage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-ds-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${inv.percentage}%`, backgroundColor: pieColors[i % pieColors.length] }}
                        />
                      </div>
                      <div className="flex justify-between mt-1 text-[10px] text-ds-muted">
                        <span>{inv.slices_owned.toLocaleString()} slices</span>
                        {inv.email && <span>{inv.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Allocation summary */}
              {currentProperty && (
                <div className="mt-4 pt-3 border-t border-ds-border text-xs text-ds-muted">
                  <div className="flex justify-between">
                    <span>Allocated</span>
                    <span>{investors.reduce((s, i) => s + i.slices_owned, 0).toLocaleString()} / {currentProperty.total_slices.toLocaleString()} slices</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>Available</span>
                    <span className="text-ds-green">
                      {(currentProperty.total_slices - investors.reduce((s, i) => s + i.slices_owned, 0)).toLocaleString()} slices
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Add Investor Form */}
          <div className="glass rounded-2xl p-6">
            <h2 className="font-semibold mb-4">Add Investor</h2>
            <form onSubmit={handleAddInvestor} className="space-y-4">
              <div>
                <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                  placeholder="Investor name"
                />
              </div>
              <div>
                <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                  placeholder="investor@example.com"
                />
              </div>
              <div>
                <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Slices *</label>
                <input
                  type="number"
                  value={slices}
                  onChange={(e) => setSlices(e.target.value)}
                  required
                  min="1"
                  className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                  placeholder="100"
                />
                {slices && currentProperty && (
                  <p className="text-xs text-ds-muted mt-1">
                    = {((Number(slices) / currentProperty.total_slices) * 100).toFixed(2)}% ownership
                    (${(Math.round(currentProperty.valuation_usd / currentProperty.total_slices) * Number(slices)).toLocaleString()} value)
                  </p>
                )}
              </div>

              {error && <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-2 text-sm text-ds-red">{error}</div>}
              {success && <div className="bg-ds-green/10 border border-ds-green/30 rounded-lg px-4 py-2 text-sm text-ds-green">{success}</div>}

              <button
                type="submit"
                disabled={adding || !name || !slices}
                className="w-full text-white font-semibold py-2.5 rounded-[10px] transition-all disabled:opacity-50 text-[13px] hover:translate-y-[-1px]"
                style={{ background: "linear-gradient(135deg, #0D9488, #e17055)", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
              >
                {adding ? "Adding..." : "Add Investor"}
              </button>

              <p className="text-[10px] text-ds-muted text-center">
                Adding an investor logs to the HCS audit trail (tamper-proof).
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
