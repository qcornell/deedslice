"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { HEDERA_NETWORK, HASHSCAN_BASE } from "@/lib/hedera/config";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import ImageUpload from "@/components/ImageUpload";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

interface TxStep { step: string; txId: string; explorerUrl: string; }
interface PropertyDetails { bedrooms?: number | null; bathrooms?: number | null; squareFootage?: number | null; yearBuilt?: number | null; }

/* ═══════════════════════════════════════════════════════════════
 *  Tokenize Property — single-page form with auto-address
 *  Kept our flow (better than Claude Code's 3-step since we have
 *  Mapbox autocomplete + RentCast auto-valuation). Took Claude's
 *  form styling, info box, label treatment, and file upload look.
 * ═══════════════════════════════════════════════════════════════ */

export default function NewPropertyPage() {
  const { session, user } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("residential");
  const [valuationUsd, setValuationUsd] = useState("");
  const [totalSlices, setTotalSlices] = useState("1000");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deployNetwork, setDeployNetwork] = useState<"mainnet" | "testnet">("mainnet");
  const [fetchingValue, setFetchingValue] = useState(false);
  const [valuationSource, setValuationSource] = useState<string | null>(null);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails>({});

  const [deploying, setDeploying] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [transactions, setTransactions] = useState<TxStep[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [propertyId, setPropertyId] = useState("");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [paymentPending, setPaymentPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("ds_profiles").select("*").eq("id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data as any); });
  }, [user]);

  // Set default network based on plan
  useEffect(() => {
    if (profile) {
      setDeployNetwork(profile.plan === "starter" ? "testnet" : "mainnet");
    }
  }, [profile]);

  const pricePerSlice = valuationUsd && totalSlices ? Math.round(Number(valuationUsd) / Number(totalSlices)) : 0;
  const credits = (profile as any)?.tokenization_credits || 0;
  const isMainnet = deployNetwork === "mainnet";
  const needsTokenizationFee = profile ? profile.plan === "pro" && isMainnet && credits < 1 : false;

  async function handlePayAndDeploy(pack?: "5pack") {
    if (!session) return;
    setPaymentPending(true); setError("");
    try {
      const res = await fetch("/api/stripe/tokenize-checkout", {
        method: "POST", headers: getAuthHeaders(session),
        body: JSON.stringify({ propertyName: name, pack: pack || "single" }),
      });
      const data = await res.json();
      if (data.free) {
        // Has credits or is free tier — just deploy directly
        const form = document.getElementById("tokenize-form") as HTMLFormElement;
        if (form) form.requestSubmit();
        return;
      }
      if (data.url) {
        sessionStorage.setItem("ds_pending_tokenize", JSON.stringify({ name, address, propertyType, valuationUsd, totalSlices, description, imageUrl }));
        window.location.href = data.url;
      } else { setError(data.error || "Failed to create payment"); }
    } catch (err: any) { setError(err.message || "Network error"); } finally { setPaymentPending(false); }
  }

  function handleBuyPack() {
    handlePayAndDeploy("5pack");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tokenize_paid") === "true" && session) {
      const saved = sessionStorage.getItem("ds_pending_tokenize");
      if (saved) {
        sessionStorage.removeItem("ds_pending_tokenize");
        const data = JSON.parse(saved);
        setName(data.name || ""); setAddress(data.address || ""); setPropertyType(data.propertyType || "residential");
        setValuationUsd(data.valuationUsd || ""); setTotalSlices(data.totalSlices || "1000");
        setDescription(data.description || ""); setImageUrl(data.imageUrl || null);
        window.history.replaceState({}, "", "/dashboard/new");
        setTimeout(() => { const form = document.getElementById("tokenize-form") as HTMLFormElement; if (form) form.requestSubmit(); }, 500);
      }
    }
  }, [session]);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (needsTokenizationFee) { handlePayAndDeploy(); return; }
    setError(""); setDeploying(true); setCurrentStep("Initiating tokenization..."); setTransactions([]);
    try {
      const res = await fetch("/api/tokenize", {
        method: "POST", headers: getAuthHeaders(session),
        body: JSON.stringify({ name, address, propertyType, valuationUsd: Number(valuationUsd), totalSlices: Number(totalSlices), description, imageUrl, network: deployNetwork }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Tokenization failed"); if (data.transactions) setTransactions(data.transactions); return; }
      setTransactions(data.transactions || []); setPropertyId(data.propertyId); setSuccess(true);
    } catch (err: any) { setError(err.message || "Network error"); } finally { setDeploying(false); setCurrentStep(""); }
  }

  if (success) {
    return <TokenizationSuccess name={name} valuationUsd={Number(valuationUsd)} totalSlices={Number(totalSlices)} transactions={transactions} propertyId={propertyId} />;
  }

  // Shared input classes matching Claude Code's form styling
  const inputCls = "w-full border rounded-lg px-3 py-2.5 text-[14px] transition-all focus:outline-none focus:border-[#0ab4aa] focus:shadow-[0_0_0_3px_rgba(10,180,170,0.1)]";
  const inputStyle: React.CSSProperties = { background: "white", borderColor: "#E3E8EF", color: "#1A1F36" };
  const labelCls = "block text-[14px] mb-2";
  const labelStyle: React.CSSProperties = { color: "#1A1F36", fontWeight: 500 };
  const helpCls = "text-[13px] mt-1";
  const helpStyle: React.CSSProperties = { color: "#8792A2" };

  return (
    <div className="max-w-[800px] mx-auto animate-fade-in">
      {/* Info box — from Claude Code */}
      <div className="flex gap-4 rounded-lg p-4 mb-6" style={{ background: "rgba(10,180,170,0.05)", border: "1px solid rgba(10,180,170,0.2)" }}>
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#0ab4aa" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-[14px]" style={{ color: "#697386", lineHeight: 1.5 }}>
          Enter your property details below. The address field auto-fills valuation, type, and property info. One click deploys to Hedera.
        </p>
      </div>

      <form id="tokenize-form" onSubmit={handleDeploy} className="glass rounded-xl p-6 sm:p-8">
        <h2 className="text-[20px] mb-1" style={{ color: "#1A1F36", fontWeight: 600 }}>Property Information</h2>
        <p className="text-[14px] mb-6" style={{ color: "#697386" }}>Provide details about the property you want to tokenize</p>

        <div className="space-y-5">
          {/* Row: Name + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Property Name <span style={{ color: "#DF1B41" }}>*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g., 2960 Boxelder Drive" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Property Type</label>
              <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className={inputCls} style={{ ...inputStyle, appearance: "none" as const, backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%238792A2' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", paddingRight: "40px", cursor: "pointer" }}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="land">Land</option>
                <option value="industrial">Industrial</option>
                <option value="mixed">Mixed Use</option>
              </select>
            </div>
          </div>

          {/* Address — single field with autocomplete */}
          <div>
            <label className={labelCls} style={labelStyle}>Street Address</label>
            <AddressAutocomplete
              value={address}
              onChange={setAddress}
              className={inputCls + " !bg-white !border-[#E3E8EF]"}
              onAddressSelect={async (retrieved) => {
                setAddress(retrieved.fullAddress);
                if (!name && retrieved.streetAddress) setName(retrieved.streetAddress);
                setFetchingValue(true); setValuationSource(null);
                try {
                  const res = await fetch(`/api/property-value?address=${encodeURIComponent(retrieved.fullAddress)}`);
                  const data = await res.json();
                  if (data.estimate) { setValuationUsd(String(Math.round(data.estimate))); setValuationSource(data.source === "rentcast_avm" ? "RentCast AVM estimate" : "Tax assessment"); }
                  if (data.propertyType) {
                    const typeMap: Record<string, string> = { "Single Family": "residential", "Multi Family": "residential", "Condo": "residential", "Townhouse": "residential", "Commercial": "commercial", "Land": "land", "Industrial": "industrial" };
                    const mapped = typeMap[data.propertyType]; if (mapped) setPropertyType(mapped);
                  }
                  setPropertyDetails({ bedrooms: data.bedrooms, bathrooms: data.bathrooms, squareFootage: data.squareFootage, yearBuilt: data.yearBuilt });
                } catch {} finally { setFetchingValue(false); }
              }}
              placeholder="Start typing an address..."
            />
            {fetchingValue && (
              <div className="flex items-center gap-2 mt-2 text-[13px]" style={{ color: "#0ab4aa" }}>
                <div className="w-3 h-3 border-2 border-[#0ab4aa]/40 border-t-[#0ab4aa] rounded-full animate-spin" />
                Looking up property value...
              </div>
            )}
            {propertyDetails.squareFootage && (
              <div className="flex flex-wrap gap-4 mt-2 text-[13px]" style={{ color: "#8792A2" }}>
                {propertyDetails.bedrooms && <span>{propertyDetails.bedrooms} bed</span>}
                {propertyDetails.bathrooms && <span>{propertyDetails.bathrooms} bath</span>}
                {propertyDetails.squareFootage && <span>{propertyDetails.squareFootage.toLocaleString()} sq ft</span>}
                {propertyDetails.yearBuilt && <span>Built {propertyDetails.yearBuilt}</span>}
              </div>
            )}
            <p className={helpCls} style={helpStyle}>Auto-fills valuation, property type, and details when you select an address</p>
          </div>

          {/* Row: Valuation + Slices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls} style={labelStyle}>Property Value (USD) <span style={{ color: "#DF1B41" }}>*</span></label>
              <input type="number" value={valuationUsd} onChange={e => { setValuationUsd(e.target.value); setValuationSource(null); }} required min="1" placeholder="500000" className={inputCls} style={inputStyle} />
              {valuationSource && <p className="text-[12px] mt-1" style={{ color: "#0ACF83" }}>✓ Auto-filled from {valuationSource}</p>}
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Total Slices <span style={{ color: "#DF1B41" }}>*</span></label>
              <input type="number" value={totalSlices} onChange={e => setTotalSlices(e.target.value)} required min="1" max="1000000" placeholder="1000" className={inputCls} style={inputStyle} />
              {pricePerSlice > 0 && <p className={helpCls} style={helpStyle}>→ <span style={{ color: "#0ab4aa", fontWeight: 500 }}>${pricePerSlice.toLocaleString()}</span> per slice</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={labelCls} style={labelStyle}>Property Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe the property, its features, and location benefits..." className={inputCls} style={{ ...inputStyle, resize: "vertical" as const, minHeight: "100px" }} />
            <p className={helpCls} style={helpStyle}>Optional: shown on the public investor view page</p>
          </div>

          {/* Property Image */}
          <div>
            <label className={labelCls} style={labelStyle}>Property Images</label>
            <ImageUpload session={session} currentUrl={imageUrl} onUploaded={url => setImageUrl(url)} />
          </div>

          {/* Network selector */}
          <div className="rounded-lg p-4 border" style={{
            background: deployNetwork === "mainnet" ? "rgba(10,207,131,0.05)" : "rgba(255,165,0,0.05)",
            borderColor: deployNetwork === "mainnet" ? "rgba(10,207,131,0.2)" : "rgba(255,165,0,0.2)",
          }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${deployNetwork === "mainnet" ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
                  <span className="text-[13px]" style={{ color: "#1A1F36", fontWeight: 500 }}>
                    Deploying to Hedera {deployNetwork === "mainnet" ? "Mainnet" : "Testnet"}
                  </span>
                </div>
                <p className="text-[12px] ml-4" style={{ color: "#8792A2" }}>
                  {deployNetwork === "mainnet"
                    ? "Live blockchain — tokens are real and permanent."
                    : profile?.plan === "starter"
                      ? "Sandbox mode — free to experiment. Upgrade to Operator for mainnet."
                      : "Sandbox mode — test before going live. No real tokens created."}
                </p>
              </div>

              {/* Toggle — only for Pro/Enterprise */}
              {profile && profile.plan !== "starter" && (
                <button
                  type="button"
                  onClick={() => setDeployNetwork(n => n === "mainnet" ? "testnet" : "mainnet")}
                  className="flex-shrink-0 ml-4 relative inline-flex h-7 w-[52px] items-center rounded-full transition-colors duration-200"
                  style={{ background: deployNetwork === "mainnet" ? "#0ACF83" : "#F59E0B" }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: deployNetwork === "mainnet" ? "translateX(26px)" : "translateX(4px)" }}
                  />
                </button>
              )}
            </div>
          </div>

          {/* Deployment Preview */}
          <div className="rounded-lg p-5 border" style={{ background: "#F6F9FC", borderColor: "#E3E8EF" }}>
            <div className="text-[12px] uppercase tracking-[0.5px] mb-4" style={{ color: "#8792A2", fontWeight: 500 }}>Deployment Preview</div>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  NFT Master Deed
                </div>
                <span style={{ color: "#1A1F36" }}>1 unique token</span>
              </div>
              <div className="flex justify-between">
                <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Share Tokens
                </div>
                <span style={{ color: "#1A1F36" }}>{Number(totalSlices || 0).toLocaleString()} fungible tokens</span>
              </div>
              <div className="flex justify-between">
                <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  Audit Trail
                </div>
                <span style={{ color: "#1A1F36" }}>HCS topic (tamper-proof)</span>
              </div>
              <div className="flex justify-between">
                <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Hedera Fees
                </div>
                <span style={{ color: "#0ACF83" }}>~$0.01</span>
              </div>
              {isMainnet && profile?.plan === "pro" && credits > 0 && (
                <div className="flex justify-between pt-3 border-t" style={{ borderColor: "#E3E8EF" }}>
                  <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Tokenization Credit
                  </div>
                  <span style={{ color: "#0ACF83", fontWeight: 600 }}>1 of {credits} credits</span>
                </div>
              )}
              {needsTokenizationFee && (
                <div className="flex justify-between pt-3 border-t" style={{ borderColor: "#E3E8EF" }}>
                  <div className="flex items-center gap-2" style={{ color: "#697386" }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    Tokenization Credit Required
                  </div>
                  <span style={{ color: "#DF1B41", fontWeight: 600 }}>$1,499</span>
                </div>
              )}
            </div>
          </div>

          {/* Tokenization credit notice */}
          {needsTokenizationFee && (
            <div className="rounded-lg p-4 border" style={{ background: "rgba(255,165,0,0.05)", borderColor: "rgba(255,165,0,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <svg width="16" height="16" fill="none" stroke="#D97706" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="text-[13px]" style={{ color: "#D97706", fontWeight: 600 }}>Tokenization Credit Required</span>
              </div>
              <p className="text-[13px] ml-6" style={{ color: "#697386" }}>
                You need a tokenization credit to deploy on mainnet. Purchase below or save with the 5-pack.
              </p>
              <div className="flex gap-3 ml-6 mt-3">
                <button type="button" onClick={() => handlePayAndDeploy()} className="px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:shadow-md" style={{ background: "#0ab4aa" }}>
                  Buy 1 Credit — $1,499
                </button>
                <button type="button" onClick={() => { handleBuyPack(); }} className="px-4 py-2 rounded-lg text-[13px] font-medium border transition-all hover:bg-[#F6F9FC]" style={{ borderColor: "#0D9488", color: "#0D9488" }}>
                  Buy 5 Credits — $4,999 <span className="text-[11px] opacity-70">(save $2,496)</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-3 text-[14px]" style={{ background: "rgba(223,27,65,0.06)", border: "1px solid rgba(223,27,65,0.2)", color: "#DF1B41" }}>
              {error}
            </div>
          )}

          {/* Deploy progress */}
          {deploying && (
            <div className="space-y-3">
              <div className="flex flex-col items-center py-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-[#0ab4aa]/30 animate-ping" />
                  <div className="absolute inset-1 rounded-full border-2 border-[#0ab4aa]/50 animate-pulse" />
                  <div className="absolute inset-3 rounded-full bg-[#0ab4aa]/10 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-[#0ab4aa] border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
                <p className="text-[14px] mt-4 animate-pulse" style={{ color: "#0ab4aa", fontWeight: 500 }}>{currentStep}</p>
              </div>
              {transactions.map((tx, i) => (
                <div key={i} className="flex items-center gap-3 text-[14px] rounded-lg px-4 py-3 animate-fade-in" style={{ background: "rgba(10,207,131,0.05)", border: "1px solid rgba(10,207,131,0.2)" }}>
                  <svg width="18" height="18" fill="none" stroke="#0ACF83" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="flex-1">{tx.step}</span>
                  <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono hover:underline" style={{ color: "#0ab4aa" }}>View →</a>
                </div>
              ))}
            </div>
          )}

          {/* Actions — matching Claude Code's form-actions pattern */}
          <div className="flex justify-between items-center gap-4 pt-5 border-t" style={{ borderColor: "#E3E8EF" }}>
            <button type="button" onClick={() => router.back()} className="px-5 py-3 rounded-lg border text-[14px] transition-all hover:bg-[#F6F9FC]" style={{ borderColor: "#E3E8EF", color: "#1A1F36", background: "white", fontWeight: 500 }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={deploying || paymentPending || !name || !valuationUsd || !totalSlices}
              className="px-6 py-3 rounded-lg text-white text-[14px] transition-all disabled:opacity-50 hover:shadow-md flex items-center gap-2"
              style={{ background: "#0ab4aa", fontWeight: 500 }}
              onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "#089991"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#0ab4aa"; }}
            >
              {deploying ? "Deploying to Hedera..." : paymentPending ? "Redirecting to payment..." : needsTokenizationFee ? (
                <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>Purchase Credit to Deploy</>
              ) : (
                <><svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>Deploy to Hedera</>
              )}
            </button>
          </div>

          <p className="text-center text-[12px]" style={{ color: "#8792A2" }}>
            5 on-chain transactions · ~$0.01 Hedera fees · results in ~10 seconds
            {isMainnet && profile?.plan === "pro" && credits > 0 && ` · using 1 of ${credits} credits`}
          </p>
          <p className="text-center text-[11px]" style={{ color: "#8792A2", opacity: 0.6 }}>
            By deploying, you agree to our <a href="/terms" target="_blank" className="hover:underline" style={{ color: "#0ab4aa" }}>Terms of Service</a>.
            Blockchain transactions are permanent and irreversible.
          </p>
        </div>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Success Screen — keeping the celebration energy
 * ═══════════════════════════════════════════════════════════════ */

function TokenizationSuccess({ name, valuationUsd, totalSlices, transactions, propertyId }: {
  name: string; valuationUsd: number; totalSlices: number; transactions: TxStep[]; propertyId: string;
}) {
  const router = useRouter();
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const [showContent, setShowContent] = useState(false);
  const [countedVal, setCountedVal] = useState(0);

  useEffect(() => {
    const canvas = confettiCanvas.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const colors = ["#0D9488", "#10B981", "#6366F1", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
    const particles: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rot: number; vr: number; life: number }[] = [];
    for (let i = 0; i < 150; i++) {
      particles.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * 300, w: 4 + Math.random() * 8, h: 6 + Math.random() * 12, color: colors[Math.floor(Math.random() * colors.length)], vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.15, life: 1 });
    }
    let frame: number;
    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height); let alive = false;
      for (const p of particles) { if (p.life <= 0) continue; alive = true; p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.rot += p.vr; if (p.y > canvas!.height + 20) { p.life = 0; continue; } ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot); ctx!.fillStyle = p.color; ctx!.globalAlpha = Math.min(1, p.life); ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx!.restore(); }
      if (alive) frame = requestAnimationFrame(animate);
    }
    animate(); return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => { const t = setTimeout(() => setShowContent(true), 400); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (!showContent) return;
    const target = valuationUsd; const duration = 1500; const start = performance.now();
    function tick(now: number) { const elapsed = now - start; const progress = Math.min(elapsed / duration, 1); const eased = 1 - Math.pow(1 - progress, 3); setCountedVal(Math.round(target * eased)); if (progress < 1) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }, [showContent, valuationUsd]);

  return (
    <div className="max-w-2xl mx-auto relative">
      <canvas ref={confettiCanvas} className="fixed inset-0 pointer-events-none z-50" />
      <div className={`relative z-10 transition-all duration-700 ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="glass rounded-xl p-6 sm:p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 rounded-xl p-[1px] pointer-events-none overflow-hidden">
            <div className="absolute -inset-full animate-spin-slow" style={{ background: "conic-gradient(from 0deg, transparent, #0D9488, transparent, #6366F1, transparent)", animationDuration: "4s" }} />
          </div>

          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full animate-pulse" style={{ background: "radial-gradient(circle, rgba(13,148,136,0.3) 0%, transparent 70%)" }} />
            <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(13,148,136,0.15) 0%, rgba(99,102,241,0.1) 100%)" }}>
              <svg width="36" height="36" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl mb-2" style={{ fontWeight: 700, color: "#1A1F36" }}>Property Tokenized!</h1>
          <p style={{ color: "#697386" }}>{name} is now <span style={{ color: "#0ACF83", fontWeight: 600 }}>live on Hedera {HEDERA_NETWORK === "mainnet" ? "Mainnet" : "Testnet"}</span></p>

          <div className="my-6 py-5 rounded-xl" style={{ background: "#F6F9FC" }}>
            <div className="text-3xl sm:text-5xl" style={{ fontWeight: 700, color: "#1A1F36", fontVariantNumeric: "tabular-nums" }}>${countedVal.toLocaleString()}</div>
            <div className="text-[14px] mt-1" style={{ color: "#697386" }}>{totalSlices.toLocaleString()} slices · ${Math.round(valuationUsd / totalSlices)}/slice</div>
          </div>

          <div className="text-left mb-6 space-y-2">
            <div className="text-[12px] uppercase tracking-[0.5px] mb-3 text-center" style={{ color: "#8792A2", fontWeight: 500 }}>5 Blockchain Transactions — Verified</div>
            {transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-4 py-3 text-[14px]" style={{ background: "rgba(13,148,136,0.04)", border: "1px solid rgba(13,148,136,0.12)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(10,207,131,0.15)" }}>
                    <svg width="12" height="12" fill="none" stroke="#0ACF83" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span style={{ fontWeight: 500 }}>{tx.step}</span>
                </div>
                <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-mono hover:underline" style={{ color: "#0ab4aa" }}>Verify →</a>
              </div>
            ))}
          </div>

          <p className="text-[13px] mb-6" style={{ color: "#8792A2" }}>
            Share your investor dashboard: <span className="font-mono" style={{ color: "#0ab4aa" }}>console.deedslice.com/view/{propertyId}</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push(`/dashboard/property/${propertyId}`)} className="text-white px-8 py-3.5 rounded-lg text-[14px] transition-all hover:shadow-md" style={{ background: "#0ab4aa", fontWeight: 500 }} onMouseEnter={e => { e.currentTarget.style.background = "#089991"; }} onMouseLeave={e => { e.currentTarget.style.background = "#0ab4aa"; }}>
              View Property Dashboard →
            </button>
            <button onClick={() => router.push("/dashboard")} className="border px-6 py-3.5 rounded-lg text-[14px] transition-all hover:bg-[#F6F9FC]" style={{ borderColor: "#E3E8EF", color: "#697386", fontWeight: 500 }}>
              All Properties
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
