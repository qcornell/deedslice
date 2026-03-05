"use client";

/**
 * Settings Page — Upgraded UI (2026-03-05)
 *
 * Tabbed layout matching Claude mockup:
 *   Billing & Plans · API & Integrations · Profile · Security
 *   All existing functionality preserved: Stripe upgrade, API keys,
 *   webhooks, white-label settings, plan display, danger zone.
 *   No emoji icons — all proper SVGs.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import type { Profile, ApiKey, Webhook } from "@/types/database";
import WhiteLabelSettings from "@/components/WhiteLabelSettings";

const PLAN_DETAILS = {
  starter: {
    name: "Starter",
    price: "Free",
    color: "#8792A2",
    properties: "1 property",
    features: ["1 property (testnet sandbox)", "NFT deed + share tokens", "Basic dashboard", "HCS audit log", "Try before you buy"],
  },
  pro: {
    name: "Pro",
    price: "$99.99/mo",
    color: "#0D9488",
    properties: "5 properties",
    features: ["5 properties (mainnet)", "Full investor dashboard", "Document vault (SHA-256 → HCS)", "Investor management", "Token transfers to wallets", "Email support", "+$199 per additional tokenization"],
  },
  enterprise: {
    name: "Enterprise",
    price: "$499.99/mo",
    color: "#DF1B41",
    properties: "Unlimited",
    features: ["Unlimited properties", "REST API access", "Priority support", "Custom integrations", "Webhooks", "White-label investor portal"],
  },
};

const TABS = [
  {
    id: "billing",
    label: "Billing & Plans",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
  {
    id: "api",
    label: "API & Integrations",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  },
  {
    id: "profile",
    label: "Profile",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    id: "security",
    label: "Security",
    icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  },
];

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { session, user } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("billing");

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  // Profile form
  const [profileFullName, setProfileFullName] = useState("");
  const [profileCompany, setProfileCompany] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    if (upgraded) {
      setUpgradeSuccess(upgraded);
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
          setProfileFullName((data as any).full_name || "");
          setProfileCompany((data as any).company_name || "");
        } else {
          setProfile({
            id: user.id,
            email: user.email || "",
            plan: "starter",
            properties_used: 0,
            properties_limit: 1,
            company_name: null,
            full_name: null,
          } as any);
        }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!session || !profile || profile.plan !== "enterprise") return;
    fetch("/api/api-keys", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setApiKeys(d.keys || []))
      .catch(() => {});
    fetch("/api/webhooks", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setWebhooks(d.webhooks || []))
      .catch(() => {});
  }, [session, profile]);

  async function handleCreateApiKey() {
    if (!session) return;
    setCreatingKey(true);
    setNewKeyRaw(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ name: newKeyName || "Default" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewKeyRaw(data.key);
      setNewKeyName("");
      const rr = await fetch("/api/api-keys", { headers: getAuthHeaders(session) });
      const rd = await rr.json();
      setApiKeys(rd.keys || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleDeleteApiKey(id: string) {
    if (!session || !confirm("Delete this API key?")) return;
    await fetch("/api/api-keys", { method: "DELETE", headers: getAuthHeaders(session), body: JSON.stringify({ id }) });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
  }

  async function handleCreateWebhook() {
    if (!session || !newWebhookUrl) return;
    setCreatingWebhook(true);
    setNewWebhookSecret(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ url: newWebhookUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewWebhookSecret(data.secret);
      setNewWebhookUrl("");
      const rr = await fetch("/api/webhooks", { headers: getAuthHeaders(session) });
      const rd = await rr.json();
      setWebhooks(rd.webhooks || []);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!session || !confirm("Delete this webhook?")) return;
    await fetch("/api/webhooks", { method: "DELETE", headers: getAuthHeaders(session), body: JSON.stringify({ id }) });
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

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
        alert(data.error || "Failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setUpgrading(null);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    setProfileMsg("");
    try {
      const { error } = await supabase
        .from("ds_profiles")
        .update({ full_name: profileFullName || null, company_name: profileCompany || null })
        .eq("id", user.id);
      if (error) throw error;
      setProfileMsg("Profile updated");
      setTimeout(() => setProfileMsg(""), 3000);
    } catch (err: any) {
      setProfileMsg(err.message || "Failed to save");
    } finally {
      setProfileSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const currentPlan = profile?.plan || "starter";
  const planInfo = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS];

  return (
    <div className="max-w-[1100px] mx-auto animate-fade-in">
      {/* ── Tabs ── */}
      <div className="glass rounded-xl mb-6 overflow-hidden">
        <div className="flex overflow-x-auto border-b" style={{ borderColor: "#E3E8EF" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-6 py-3.5 text-[14px] font-medium transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-[#0D9488] border-[#0D9488]"
                  : "text-[#697386] border-transparent hover:text-[#1A1F36]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div
          className="mb-6 rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-in"
          style={{ background: "rgba(10,207,131,0.08)", border: "1px solid rgba(10,207,131,0.25)" }}
        >
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(10,207,131,0.15)" }}>
            <svg width="16" height="16" fill="none" stroke="#0ACF83" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="font-semibold" style={{ color: "#0ACF83" }}>
              Welcome to {PLAN_DETAILS[upgradeSuccess as keyof typeof PLAN_DETAILS]?.name || upgradeSuccess}!
            </div>
            <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
              Your plan has been upgraded. New limits are active immediately.
            </p>
          </div>
          <button onClick={() => setUpgradeSuccess(null)} className="text-lg p-1" style={{ color: "#8792A2" }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══ BILLING TAB ═══ */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Current Plan</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="grid grid-cols-2 gap-x-12 gap-y-4 flex-1">
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Price</div>
                    <div className="text-[16px] font-semibold mt-0.5" style={{ color: "#1A1F36" }}>{planInfo.price}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Properties</div>
                    <div className="text-[16px] font-semibold mt-0.5" style={{ color: "#1A1F36" }}>
                      {profile?.properties_used || 0} / {profile?.properties_limit || 1}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Email</div>
                    <div className="text-[16px] font-semibold mt-0.5" style={{ color: "#1A1F36" }}>{profile?.email}</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#697386" }}>Company</div>
                    <div className="text-[16px] font-semibold mt-0.5" style={{ color: "#1A1F36" }}>{profile?.company_name || "—"}</div>
                  </div>
                </div>
                <span
                  className="px-3 py-1.5 rounded-lg text-[14px] font-semibold"
                  style={{
                    background:
                      currentPlan === "enterprise"
                        ? "rgba(223,27,65,0.1)"
                        : currentPlan === "pro"
                          ? "rgba(13,148,136,0.1)"
                          : "rgba(135,146,162,0.15)",
                    color: planInfo.color,
                  }}
                >
                  {planInfo.name}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(Object.entries(PLAN_DETAILS) as [string, (typeof PLAN_DETAILS)["starter"]][]).map(([key, plan]) => {
              const isCurrent = key === currentPlan;
              const canUpgrade =
                !isCurrent &&
                ((key === "pro" && currentPlan === "starter") ||
                  (key === "enterprise" && (currentPlan === "starter" || currentPlan === "pro")));
              return (
                <div
                  key={key}
                  className="glass rounded-xl p-6 relative"
                  style={isCurrent ? { borderColor: "#0D9488", borderWidth: 2 } : {}}
                >
                  {key === "pro" && !isCurrent && (
                    <span
                      className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(255,165,0,0.1)", color: "#FFA500" }}
                    >
                      Popular
                    </span>
                  )}
                  {isCurrent && (
                    <span
                      className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide"
                      style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }}
                    >
                      Current
                    </span>
                  )}
                  <div className="text-[14px] font-medium mb-2" style={{ color: plan.color }}>
                    {plan.name}
                  </div>
                  <div className="text-[36px] font-bold mb-6" style={{ color: "#1A1F36" }}>
                    {plan.price}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[14px]" style={{ color: "#697386" }}>
                        <svg
                          width="14"
                          height="14"
                          fill="none"
                          stroke="#0ACF83"
                          viewBox="0 0 24 24"
                          className="flex-shrink-0 mt-0.5"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {canUpgrade ? (
                    <button
                      onClick={() => handleUpgrade(key as "pro" | "enterprise")}
                      disabled={!!upgrading}
                      className="w-full text-white font-medium py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50 hover:shadow-md"
                      style={{ background: "#0ab4aa" }}
                    >
                      {upgrading === key ? "Redirecting..." : `Upgrade to ${plan.name}`}
                    </button>
                  ) : isCurrent ? (
                    <div
                      className="w-full text-center py-2.5 text-[14px] border-t"
                      style={{ borderColor: "#E3E8EF", color: "#8792A2" }}
                    >
                      Your current plan
                    </div>
                  ) : (
                    <div className="w-full text-center py-2.5 text-[14px]" style={{ color: "#8792A2" }}>
                      —
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ API TAB ═══ */}
      {activeTab === "api" && (
        <div className="space-y-6">
          {/* API Keys */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>REST API Keys</h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
                Authenticate programmatic access to the DeedSlice API
              </p>
            </div>
            <div className="p-6">
              {profile?.plan !== "enterprise" ? (
                <div
                  className="flex items-start gap-3 rounded-lg p-4 border text-[14px]"
                  style={{ background: "rgba(255,165,0,0.04)", borderColor: "rgba(255,165,0,0.2)", color: "#697386" }}
                >
                  <svg width="18" height="18" fill="none" stroke="#FFA500" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    API access requires an Enterprise plan.{" "}
                    <button onClick={() => handleUpgrade("enterprise")} className="font-medium hover:underline" style={{ color: "#0D9488" }}>
                      Upgrade now
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {newKeyRaw && (
                    <div
                      className="rounded-lg p-4 mb-4 animate-fade-in"
                      style={{ background: "rgba(10,207,131,0.06)", border: "1px solid rgba(10,207,131,0.2)" }}
                    >
                      <div className="flex items-center gap-2 text-[13px] font-medium mb-2" style={{ color: "#0ACF83" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                        New API Key — Copy now, won't be shown again
                      </div>
                      <div className="rounded-lg px-3 py-2 font-mono text-[13px] break-all select-all" style={{ background: "#F6F9FC" }}>
                        {newKeyRaw}
                      </div>
                    </div>
                  )}
                  {apiKeys.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {apiKeys.map((k) => (
                        <div key={k.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#F6F9FC" }}>
                          <div>
                            <span className="font-mono text-[13px]" style={{ color: "#1A1F36" }}>{k.key_prefix}...</span>
                            <span className="text-[13px] ml-3" style={{ color: "#8792A2" }}>{k.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[12px]" style={{ color: "#8792A2" }}>
                              {k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : "Never used"}
                            </span>
                            <button onClick={() => handleDeleteApiKey(k.id)} className="text-[12px] font-medium hover:underline" style={{ color: "#DF1B41" }}>
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Key name (e.g. Production)"
                      className="flex-1 bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    />
                    <button
                      onClick={handleCreateApiKey}
                      disabled={creatingKey}
                      className="text-white font-medium px-5 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50 hover:shadow-md"
                      style={{ background: "#0ab4aa" }}
                    >
                      {creatingKey ? "Creating..." : "Create Key"}
                    </button>
                  </div>
                  <div className="mt-5 pt-4 border-t text-[13px] space-y-1" style={{ borderColor: "#E3E8EF", color: "#697386" }}>
                    <div>
                      <span className="font-medium" style={{ color: "#1A1F36" }}>Base URL:</span>{" "}
                      <code className="font-mono" style={{ color: "#0D9488" }}>https://console.deedslice.com/api/v1</code>
                    </div>
                    <div>
                      <span className="font-medium" style={{ color: "#1A1F36" }}>Auth:</span>{" "}
                      <code className="font-mono">Authorization: Bearer ds_live_...</code>
                    </div>
                    <div>
                      <span className="font-medium" style={{ color: "#1A1F36" }}>Endpoints:</span>{" "}
                      GET /properties · GET /properties/:id · GET /properties/:id/investors · GET /properties/:id/audit
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Webhooks */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Webhooks</h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
                Receive real-time notifications when events occur
              </p>
            </div>
            <div className="p-6">
              {profile?.plan !== "enterprise" ? (
                <div
                  className="flex items-start gap-3 rounded-lg p-4 border text-[14px]"
                  style={{ background: "rgba(255,165,0,0.04)", borderColor: "rgba(255,165,0,0.2)", color: "#697386" }}
                >
                  <svg width="18" height="18" fill="none" stroke="#FFA500" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Webhooks require an Enterprise plan.
                </div>
              ) : (
                <>
                  {newWebhookSecret && (
                    <div
                      className="rounded-lg p-4 mb-4 animate-fade-in"
                      style={{ background: "rgba(10,207,131,0.06)", border: "1px solid rgba(10,207,131,0.2)" }}
                    >
                      <div className="flex items-center gap-2 text-[13px] font-medium mb-2" style={{ color: "#0ACF83" }}>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Webhook Created — Save the signing secret
                      </div>
                      <div className="rounded-lg px-3 py-2 font-mono text-[13px] break-all select-all" style={{ background: "#F6F9FC" }}>
                        {newWebhookSecret}
                      </div>
                      <p className="text-[12px] mt-1" style={{ color: "#8792A2" }}>
                        Verify payloads with HMAC-SHA256 (X-DeedSlice-Signature header)
                      </p>
                    </div>
                  )}
                  {webhooks.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {webhooks.map((w) => (
                        <div key={w.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "#F6F9FC" }}>
                          <div className="flex-1 min-w-0">
                            <div className="font-mono text-[13px] truncate" style={{ color: "#1A1F36" }}>{w.url}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${w.active ? "bg-[#0ACF83]" : "bg-[#DF1B41]"}`} />
                              <span className="text-[12px]" style={{ color: "#8792A2" }}>
                                {w.active ? "Active" : `Disabled (${w.failure_count} failures)`}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteWebhook(w.id)}
                            className="text-[12px] font-medium hover:underline ml-3 shrink-0"
                            style={{ color: "#DF1B41" }}
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://your-app.com/webhook"
                      className="flex-1 bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[#0D9488] transition"
                    />
                    <button
                      onClick={handleCreateWebhook}
                      disabled={creatingWebhook || !newWebhookUrl}
                      className="text-white font-medium px-5 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50 hover:shadow-md"
                      style={{ background: "#0ab4aa" }}
                    >
                      {creatingWebhook ? "Adding..." : "Add Webhook"}
                    </button>
                  </div>
                  <div className="mt-4 text-[13px] space-y-1" style={{ color: "#697386" }}>
                    <div>
                      <span className="font-medium" style={{ color: "#1A1F36" }}>Events:</span> property.tokenized · investor.added/updated
                      · transfer.completed/failed · document.added · kyc.updated · distribution.*
                    </div>
                    <div>Max 5 webhooks. Auto-disabled after 10 consecutive failures.</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* White-Label */}
          {profile?.plan === "enterprise" && session && <WhiteLabelSettings session={session} />}
        </div>
      )}

      {/* ═══ PROFILE TAB ═══ */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Profile Information</h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
                Update your account details
              </p>
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveProfile}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={profileCompany}
                      onChange={(e) => setProfileCompany(e.target.value)}
                      placeholder="Company name (optional)"
                      className="w-full bg-white border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#697386" }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full bg-[#F6F9FC] border border-[#E3E8EF] rounded-lg px-4 py-2.5 text-[14px] cursor-not-allowed"
                    style={{ color: "#8792A2" }}
                  />
                  <p className="text-[11px] mt-1" style={{ color: "#8792A2" }}>
                    Email is managed through your auth provider and cannot be changed here.
                  </p>
                </div>

                {profileMsg && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] mb-4 animate-fade-in"
                    style={{
                      background: profileMsg.includes("Failed") ? "rgba(223,27,65,0.08)" : "rgba(10,207,131,0.08)",
                      border: `1px solid ${profileMsg.includes("Failed") ? "rgba(223,27,65,0.2)" : "rgba(10,207,131,0.2)"}`,
                      color: profileMsg.includes("Failed") ? "#DF1B41" : "#0ACF83",
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {profileMsg}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: "#E3E8EF" }}>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 text-white font-medium px-6 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50 hover:shadow-md"
                    style={{ background: "#0ab4aa" }}
                  >
                    {profileSaving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECURITY TAB ═══ */}
      {activeTab === "security" && (
        <div className="space-y-6">
          {/* 2FA */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b" style={{ borderColor: "#E3E8EF" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#1A1F36" }}>Two-Factor Authentication</h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
                Add an extra layer of security to your account
              </p>
            </div>
            <div className="p-6">
              <div
                className="flex items-start gap-3 rounded-lg p-4"
                style={{ background: "rgba(13,148,136,0.04)", border: "1px solid rgba(13,148,136,0.15)" }}
              >
                <svg width="18" height="18" fill="none" stroke="#0D9488" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[14px]" style={{ color: "#697386" }}>
                  Two-factor authentication is currently disabled. This feature is coming soon.
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass rounded-xl overflow-hidden" style={{ borderColor: "rgba(223,27,65,0.2)" }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(223,27,65,0.15)" }}>
              <h2 className="text-[18px] font-semibold" style={{ color: "#DF1B41" }}>Danger Zone</h2>
              <p className="text-[13px] mt-0.5" style={{ color: "#697386" }}>
                Irreversible and destructive actions
              </p>
            </div>
            <div className="p-6">
              <p className="text-[14px] mb-4" style={{ color: "#697386" }}>
                Once you delete your account, all your properties, investors, and distribution data will be permanently deleted.
              </p>
              <a
                href="mailto:support@deedslice.com?subject=Account%20Deletion%20Request"
                className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-2.5 rounded-lg transition-all hover:shadow-sm"
                style={{ color: "#DF1B41", border: "1px solid rgba(223,27,65,0.3)", background: "white" }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Request Account Deletion
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
