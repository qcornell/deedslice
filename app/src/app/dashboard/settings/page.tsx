"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const PLAN_DETAILS = {
  starter: { name: "Starter", price: "Free", color: "text-ds-muted", properties: "1 property", features: ["1 property (testnet sandbox)", "NFT deed + share tokens", "Basic dashboard", "HCS audit log", "Try before you buy"] },
  pro: { name: "Pro", price: "$99.99/mo", color: "text-ds-accent-text", properties: "5 properties", features: ["5 properties (mainnet)", "Full investor dashboard", "Document vault (SHA-256 → HCS)", "Investor management", "Token transfers to wallets", "Email support", "+$199 per additional tokenization"] },
  enterprise: { name: "Enterprise", price: "$499.99/mo", color: "text-ds-orange", properties: "Unlimited", features: ["Unlimited properties", "REST API access", "Priority support", "Custom integrations", "White-label dashboard (Q2)", "Webhooks (Q2)"] },
};

export default function SettingsPage() {
  const { session, user } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

  // Check for upgrade success redirect
  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    if (upgraded) {
      setUpgradeSuccess(upgraded);
      // Clean URL without reload
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("ds_profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as any);
        } else {
          // No profile row yet — create a default in-memory profile
          setProfile({
            id: user.id,
            email: user.email || "",
            plan: "starter",
            properties_used: 0,
            properties_limit: 1,
            company_name: null,
          } as any);
        }
        setLoading(false);
      });
  }, [user]);

  async function handleUpgrade(plan: "pro" | "enterprise") {
    if (!session) return;
    setUpgrading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to create checkout");
      }
    } catch {
      alert("Network error");
    } finally {
      setUpgrading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = profile?.plan || "starter";
  const planInfo = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold heading-tight mb-8">Settings</h1>

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="mb-6 bg-ds-green/10 border border-ds-green/30 rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-in">
          <span className="text-2xl">🎉</span>
          <div>
            <div className="font-semibold text-ds-green">Welcome to {PLAN_DETAILS[upgradeSuccess as keyof typeof PLAN_DETAILS]?.name || upgradeSuccess}!</div>
            <p className="text-xs text-ds-muted mt-0.5">Your plan has been upgraded. New limits are active immediately.</p>
          </div>
          <button onClick={() => setUpgradeSuccess(null)} className="ml-auto text-ds-muted hover:text-ds-text text-lg">×</button>
        </div>
      )}

      {/* Current Plan */}
      <div className="glass rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Current Plan</h2>
          <span className={`text-lg font-bold ${planInfo.color}`}>{planInfo.name}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-ds-muted">Price</span>
            <div className="font-medium">{planInfo.price}</div>
          </div>
          <div>
            <span className="text-ds-muted">Properties</span>
            <div className="font-medium">{profile?.properties_used || 0} / {profile?.properties_limit || 1}</div>
          </div>
          <div>
            <span className="text-ds-muted">Email</span>
            <div className="font-medium">{profile?.email}</div>
          </div>
          <div>
            <span className="text-ds-muted">Company</span>
            <div className="font-medium">{profile?.company_name || "—"}</div>
          </div>
        </div>
      </div>

      {/* Plan Cards */}
      <h2 className="font-semibold mb-4">Upgrade Plan</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(PLAN_DETAILS) as [string, typeof PLAN_DETAILS["starter"]][]).map(([key, plan]) => {
          const isCurrent = key === currentPlan;
          const canUpgrade = !isCurrent && (
            (key === "pro" && currentPlan === "starter") ||
            (key === "enterprise" && (currentPlan === "starter" || currentPlan === "pro"))
          );

          return (
            <div
              key={key}
              className={`glass rounded-2xl p-6 ${isCurrent ? "glow-border" : ""} ${key === "pro" ? "ring-1 ring-ds-accent/30" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${plan.color}`}>{plan.name}</h3>
                {isCurrent && (
                  <span className="text-[10px] bg-ds-accent/15 text-ds-accent-text px-2 py-0.5 rounded-full font-semibold">CURRENT</span>
                )}
                {key === "pro" && !isCurrent && (
                  <span className="text-[10px] bg-ds-orange/20 text-ds-orange px-2 py-0.5 rounded-full">POPULAR</span>
                )}
              </div>
              <div className="text-2xl font-bold mb-4">{plan.price}</div>
              <ul className="space-y-2 text-sm text-ds-muted mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-ds-green text-xs">✓</span> {f}
                  </li>
                ))}
              </ul>
              {canUpgrade ? (
                <button
                  onClick={() => handleUpgrade(key as "pro" | "enterprise")}
                  disabled={!!upgrading}
                  className="w-full text-white font-semibold py-2.5 rounded-[10px] transition-all text-[13px] disabled:opacity-50 hover:translate-y-[-1px]"
                  style={{ background: "#0D9488", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
                >
                  {upgrading === key ? "Redirecting..." : `Upgrade to ${plan.name}`}
                </button>
              ) : isCurrent ? (
                <div className="w-full text-center py-2.5 text-sm text-ds-muted">
                  Your current plan
                </div>
              ) : (
                <div className="w-full text-center py-2.5 text-sm text-ds-muted/50">
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Danger Zone */}
      <div className="mt-12 glass rounded-2xl p-6 border-ds-red/20">
        <h2 className="font-semibold text-ds-red mb-2">Danger Zone</h2>
        <p className="text-sm text-ds-muted mb-4">Deleting your account will remove all properties and data. This cannot be undone.</p>
        <button className="text-sm text-ds-red border border-ds-red/30 px-4 py-2 rounded-lg hover:bg-ds-red/10 transition">
          Delete Account
        </button>
      </div>
    </div>
  );
}
