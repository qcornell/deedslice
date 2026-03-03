"use client";

import { useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

interface TxStep {
  step: string;
  txId: string;
  explorerUrl: string;
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
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="ds-glow">
        <div className="glass rounded-[20px] p-8 text-center relative z-10">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold heading-tight mb-2">Property Tokenized!</h1>
          <p className="text-ds-muted mb-6">{name} is now live on Hedera</p>

          {/* Transaction log */}
          <div className="text-left mb-6 space-y-3">
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between bg-ds-bg rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-ds-green">✓</span>
                  <span>{tx.step}</span>
                </div>
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ds-accent-text hover:underline text-xs font-mono"
                >
                  View →
                </a>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/dashboard/property/${propertyId}`)}
              className="text-white font-semibold px-6 py-3 rounded-[10px] transition-all text-[13px] hover:translate-y-[-1px]"
              style={{ background: "#0D9488", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
            >
              View Property Dashboard
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="border border-ds-border text-ds-muted font-medium px-6 py-3 rounded-[10px] hover:border-ds-muted transition text-sm"
            >
              Back to Properties
            </button>
          </div>
        </div>
        </div>
      </div>
    );
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

        {/* Address */}
        <div>
          <label className="block text-xs text-ds-muted mb-1.5 uppercase tracking-wider">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
            placeholder="2960 Boxelder Dr, Bryan, TX 77807"
          />
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
              onChange={(e) => setValuationUsd(e.target.value)}
              required
              min="1"
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-ds-accent transition"
              placeholder="425000"
            />
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

        {/* Deploy progress */}
        {deploying && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-ds-accent-text">
              <div className="w-4 h-4 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
              {currentStep}
            </div>
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-ds-green">
                <span>✓</span> {tx.step}
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
