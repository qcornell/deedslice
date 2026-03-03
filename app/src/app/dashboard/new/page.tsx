"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { HEDERA_NETWORK, HASHSCAN_BASE } from "@/lib/hedera/config";
import AddressAutocomplete from "@/components/AddressAutocomplete";

interface TxStep {
  step: string;
  txId: string;
  explorerUrl: string;
}

interface PropertyDetails {
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFootage?: number | null;
  yearBuilt?: number | null;
}

export default function NewPropertyPage() {
  const { session } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("residential");
  const [valuationUsd, setValuationUsd] = useState("");
  const [totalSlices, setTotalSlices] = useState("1000");
  const [description, setDescription] = useState("");
  const [fetchingValue, setFetchingValue] = useState(false);
  const [valuationSource, setValuationSource] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails>({});

  const [deploying, setDeploying] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [transactions, setTransactions] = useState<TxStep[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [propertyId, setPropertyId] = useState("");

  const pricePerSlice = valuationUsd && totalSlices
    ? Math.round(Number(valuationUsd) / Number(totalSlices))
    : 0;

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError("");
    setDeploying(true);
    setCurrentStep("Initiating tokenization...");
    setTransactions([]);

    try {
      const res = await fetch("/api/tokenize", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          name,
          address,
          propertyType,
          valuationUsd: Number(valuationUsd),
          totalSlices: Number(totalSlices),
          description,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Tokenization failed");
        if (data.transactions) setTransactions(data.transactions);
        return;
      }

      setTransactions(data.transactions || []);
      setPropertyId(data.propertyId);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setDeploying(false);
      setCurrentStep("");
    }
  }

  if (success) {
    return <TokenizationSuccess
      name={name}
      valuationUsd={Number(valuationUsd)}
      totalSlices={Number(totalSlices)}
      transactions={transactions}
      propertyId={propertyId}
    />;
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold heading-tight">Tokenize Property</h1>
        <p className="text-ds-muted text-sm mt-1">
          Enter property details and deploy to Hedera in one click
        </p>
      </div>

      <form onSubmit={handleDeploy} className="glass rounded-2xl p-8 space-y-6">
        {/* Property Name */}
        <div>
          <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Property Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
            placeholder="2960 Boxelder Drive"
          />
        </div>

        {/* Address — with autocomplete */}
        <div>
          <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Address</label>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onAddressSelect={async (retrieved) => {
              setAddress(retrieved.fullAddress);
              // Auto-derive name if empty
              if (!name && retrieved.streetAddress) {
                setName(retrieved.streetAddress);
              }
              // Fetch valuation estimate
              setFetchingValue(true);
              setValuationSource(null);
              try {
                const res = await fetch(
                  `/api/property-value?address=${encodeURIComponent(retrieved.fullAddress)}`
                );
                const data = await res.json();
                if (data.estimate) {
                  setValuationUsd(String(Math.round(data.estimate)));
                  setValuationSource(
                    data.source === "rentcast_avm"
                      ? "RentCast AVM estimate"
                      : "Tax assessment"
                  );
                }
                if (data.propertyType) {
                  const typeMap: Record<string, string> = {
                    "Single Family": "residential",
                    "Multi Family": "residential",
                    "Condo": "residential",
                    "Townhouse": "residential",
                    "Commercial": "commercial",
                    "Land": "land",
                    "Industrial": "industrial",
                  };
                  const mapped = typeMap[data.propertyType];
                  if (mapped) setPropertyType(mapped);
                }
                setPropertyDetails({
                  bedrooms: data.bedrooms,
                  bathrooms: data.bathrooms,
                  squareFootage: data.squareFootage,
                  yearBuilt: data.yearBuilt,
                });
              } catch {
                // Silent — user can still manually enter
              } finally {
                setFetchingValue(false);
              }
            }}
            placeholder="Start typing an address..."
            className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
          />
          {fetchingValue && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-ds-accent-text">
              <div className="w-3 h-3 border-2 border-ds-accent/40 border-t-ds-accent rounded-full animate-spin" />
              Looking up property value...
            </div>
          )}
          {propertyDetails.squareFootage && (
            <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-ds-muted">
              {propertyDetails.bedrooms && <span>🛏 {propertyDetails.bedrooms} bed</span>}
              {propertyDetails.bathrooms && <span>🛁 {propertyDetails.bathrooms} bath</span>}
              {propertyDetails.squareFootage && <span>📐 {propertyDetails.squareFootage.toLocaleString()} sq ft</span>}
              {propertyDetails.yearBuilt && <span>🏗 Built {propertyDetails.yearBuilt}</span>}
            </div>
          )}
        </div>

        {/* Row: Type + Valuation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Property Type</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
            >
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="land">Land</option>
              <option value="industrial">Industrial</option>
              <option value="mixed">Mixed Use</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Valuation (USD) *</label>
            <input
              type="number"
              value={valuationUsd}
              onChange={(e) => { setValuationUsd(e.target.value); setValuationSource(null); }}
              required
              min="1"
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
              placeholder="425000"
            />
            {valuationSource && (
              <p className="text-[10px] text-ds-green mt-1">
                ✓ Auto-filled from {valuationSource}
              </p>
            )}
          </div>
        </div>

        {/* Total Slices */}
        <div>
          <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Total Slices *</label>
          <input
            type="number"
            value={totalSlices}
            onChange={(e) => setTotalSlices(e.target.value)}
            required
            min="1"
            max="1000000"
            className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
            placeholder="1000"
          />
          {pricePerSlice > 0 && (
            <p className="text-xs text-ds-muted mt-1.5">
              → <span className="text-ds-accent-text font-semibold">${pricePerSlice.toLocaleString()}</span> per slice
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition resize-none"
            placeholder="4BR/2BA single family home in Bryan, TX..."
          />
        </div>

        {/* Preview card */}
        <div className="bg-ds-bg rounded-xl p-4 border border-ds-border">
          <div className="text-xs text-ds-muted uppercase tracking-wider mb-3">Deployment Preview</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ds-muted">📜 NFT Master Deed</span>
              <span className="text-ds-text">1 unique token</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ds-muted">🪙 Share Tokens</span>
              <span className="text-ds-text">{Number(totalSlices || 0).toLocaleString()} fungible tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ds-muted">📋 Audit Trail</span>
              <span className="text-ds-text">HCS topic (tamper-proof)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ds-muted">💰 Est. Cost</span>
              <span className="text-ds-green">~$0.01 (Hedera fees)</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-ds-red/10 border border-ds-red/30 rounded-lg px-4 py-3 text-sm text-ds-red">
            {error}
          </div>
        )}

        {/* Deploy progress — fancy step-by-step loader */}
        {deploying && (
          <div className="space-y-4">
            {/* Pulsing ring animation */}
            <div className="flex flex-col items-center py-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-ds-accent/30 animate-ping" />
                <div className="absolute inset-1 rounded-full border-2 border-ds-accent/50 animate-pulse" />
                <div className="absolute inset-3 rounded-full bg-ds-accent/10 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
              <p className="text-sm text-ds-accent-text font-medium mt-4 animate-pulse">{currentStep}</p>
            </div>
            {/* Completed steps */}
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 text-sm bg-ds-green/5 border border-ds-green/20 rounded-lg px-4 py-2.5 animate-fade-in">
                <span className="text-ds-green text-lg">✓</span>
                <span className="flex-1">{tx.step}</span>
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ds-accent-text hover:underline font-mono"
                >
                  View →
                </a>
              </div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={deploying || !name || !valuationUsd || !totalSlices}
          className="w-full text-white font-semibold py-3.5 rounded-[10px] transition-all disabled:opacity-50 text-[13px] hover:translate-y-[-1px]"
          style={{ background: "#0D9488", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
        >
          {deploying ? "Deploying to Hedera..." : "⚡ Deploy to Hedera"}
        </button>

        <p className="text-center text-[10px] text-ds-muted">
          5 on-chain transactions · ~$0.01 total · results in ~10 seconds
        </p>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Celebratory Success Screen — "You just hit the lotto" energy
 * ═══════════════════════════════════════════════════════════════ */

function TokenizationSuccess({
  name,
  valuationUsd,
  totalSlices,
  transactions,
  propertyId,
}: {
  name: string;
  valuationUsd: number;
  totalSlices: number;
  transactions: TxStep[];
  propertyId: string;
}) {
  const router = useRouter();
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const [showContent, setShowContent] = useState(false);
  const [countedVal, setCountedVal] = useState(0);

  // Confetti 🎉
  useEffect(() => {
    const canvas = confettiCanvas.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#0D9488", "#10B981", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
    const particles: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; vr: number; life: number }[] = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 300,
        w: 4 + Math.random() * 8,
        h: 6 + Math.random() * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.15,
        life: 1,
      });
    }

    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04; // gravity
        p.rot += p.vr;
        if (p.y > canvas!.height + 20) { p.life = 0; continue; }
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = p.color;
        ctx!.globalAlpha = Math.min(1, p.life);
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
      if (alive) frame = requestAnimationFrame(animate);
    }
    animate();

    return () => cancelAnimationFrame(frame);
  }, []);

  // Staggered content reveal
  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(t);
  }, []);

  // Count-up animation for valuation
  useEffect(() => {
    if (!showContent) return;
    const target = valuationUsd;
    const duration = 1500;
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCountedVal(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [showContent, valuationUsd]);

  return (
    <div className="max-w-2xl mx-auto relative">
      {/* Confetti canvas overlay */}
      <canvas
        ref={confettiCanvas}
        className="fixed inset-0 pointer-events-none z-50"
      />

      {/* Glow backdrop */}
      <div className="absolute -inset-12 opacity-50 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle at center, rgba(13,148,136,0.25) 0%, transparent 65%)" }}
      />

      <div className={`relative z-10 transition-all duration-700 ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="ds-glow">
          <div className="glass rounded-[24px] p-10 text-center relative z-10 overflow-hidden">
            {/* Shimmer border effect */}
            <div className="absolute inset-0 rounded-[24px] p-[1px] pointer-events-none overflow-hidden">
              <div className="absolute -inset-full animate-spin-slow"
                style={{
                  background: "conic-gradient(from 0deg, transparent, #0D9488, transparent, #6366F1, transparent)",
                  animationDuration: "4s",
                }}
              />
            </div>

            {/* Crown / trophy icon with glow */}
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full animate-pulse"
                style={{ background: "radial-gradient(circle, rgba(13,148,136,0.3) 0%, transparent 70%)" }}
              />
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-5xl"
                style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(99,102,241,0.1) 100%)" }}
              >
                🏆
              </div>
            </div>

            <h1 className="text-3xl font-extrabold heading-tight mb-2 bg-gradient-to-r from-ds-accent via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
              Property Tokenized!
            </h1>
            <p className="text-ds-muted mb-1">{name} is now <span className="text-ds-green font-semibold">live on Hedera {HEDERA_NETWORK === "mainnet" ? "Mainnet" : "Testnet"}</span></p>

            {/* Big valuation counter */}
            <div className="my-6 py-5 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.06) 0%, rgba(99,102,241,0.04) 100%)" }}>
              <div className="text-5xl font-extrabold tracking-tight" style={{ fontVariantNumeric: "tabular-nums" }}>
                ${countedVal.toLocaleString()}
              </div>
              <div className="text-sm text-ds-muted mt-1">
                {totalSlices.toLocaleString()} slices · ${Math.round(valuationUsd / totalSlices)}/slice
              </div>
            </div>

            {/* On-chain verification links */}
            <div className="text-left mb-6 space-y-2">
              <div className="text-xs text-ds-muted uppercase tracking-wider mb-3 text-center">
                5 Blockchain Transactions — Verified ✓
              </div>
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all"
                  style={{
                    background: "rgba(13,148,136,0.04)",
                    border: "1px solid rgba(13,148,136,0.12)",
                    animationDelay: `${600 + i * 100}ms`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-ds-green/20 flex items-center justify-center">
                      <span className="text-ds-green text-xs">✓</span>
                    </div>
                    <span className="font-medium">{tx.step}</span>
                  </div>
                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ds-accent-text hover:underline text-xs font-mono"
                  >
                    Verify →
                  </a>
                </div>
              ))}
            </div>

            {/* Share CTA */}
            <p className="text-xs text-ds-muted/70 mb-6">
              🔗 Share your investor dashboard: <span className="font-mono text-ds-accent-text">console.deedslice.com/view/{propertyId}</span>
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/dashboard/property/${propertyId}`)}
                className="text-white font-semibold px-8 py-3.5 rounded-[12px] transition-all text-[14px] hover:translate-y-[-2px] hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #0D9488 0%, #0F766E 100%)",
                  boxShadow: "0 4px 14px rgba(13,148,136,0.35), 0 1px 3px rgba(13,148,136,0.2)",
                }}
              >
                View Property Dashboard →
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="border border-ds-border text-ds-muted font-medium px-6 py-3.5 rounded-[12px] hover:border-ds-muted transition text-sm"
              >
                All Properties
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
