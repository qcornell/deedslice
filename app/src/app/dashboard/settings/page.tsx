"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import type { Profile, ApiKey, Webhook } from "@/types/database";
import WhiteLabelSettings from "@/components/WhiteLabelSettings";

const PLAN_DETAILS = {
  starter: { name: "Starter", price: "Free", color: "text-[#8792A2]", properties: "1 property", features: ["1 property (testnet sandbox)", "NFT deed + share tokens", "Basic dashboard", "HCS audit log", "Try before you buy"] },
  pro: { name: "Pro", price: "$99.99/mo", color: "text-[#0D9488]", properties: "5 properties", features: ["5 properties (mainnet)", "Full investor dashboard", "Document vault (SHA-256 → HCS)", "Investor management", "Token transfers to wallets", "Email support", "+$199 per additional tokenization"] },
  enterprise: { name: "Enterprise", price: "$499.99/mo", color: "text-[#DF1B41]", properties: "Unlimited", features: ["Unlimited properties", "REST API access", "Priority support", "Custom integrations", "Webhooks", "White-label investor portal"] },
};

const TABS = [
  { id: "billing", label: "Billing & Plans" },
  { id: "api", label: "API & Integrations" },
  { id: "security", label: "Security" },
];

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" /></div>}>
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

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);

  useEffect(() => {
    const upgraded = searchParams.get("upgraded");
    if (upgraded) {
      setUpgradeSuccess(upgraded);
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    supabase.from("ds_profiles").select("*").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) { setProfile(data as any); }
        else { setProfile({ id: user.id, email: user.email || "", plan: "starter", properties_used: 0, properties_limit: 1, company_name: null } as any); }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!session || !profile || profile.plan !== "enterprise") return;
    fetch("/api/api-keys", { headers: getAuthHeaders(session) }).then(r => r.json()).then(d => setApiKeys(d.keys || [])).catch(() => {});
    fetch("/api/webhooks", { headers: getAuthHeaders(session) }).then(r => r.json()).then(d => setWebhooks(d.webhooks || [])).catch(() => {});
  }, [session, profile]);

  async function handleCreateApiKey() {
    if (!session) return;
    setCreatingKey(true); setNewKeyRaw(null);
    try {
      const res = await fetch("/api/api-keys", { method: "POST", headers: getAuthHeaders(session), body: JSON.stringify({ name: newKeyName || "Default" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewKeyRaw(data.key); setNewKeyName("");
      const rr = await fetch("/api/api-keys", { headers: getAuthHeaders(session) });
      const rd = await rr.json(); setApiKeys(rd.keys || []);
    } catch (err: any) { alert(err.message); } finally { setCreatingKey(false); }
  }

  async function handleDeleteApiKey(id: string) {
    if (!session || !confirm("Delete this API key?")) return;
    await fetch("/api/api-keys", { method: "DELETE", headers: getAuthHeaders(session), body: JSON.stringify({ id }) });
    setApiKeys(prev => prev.filter(k => k.id !== id));
  }

  async function handleCreateWebhook() {
    if (!session || !newWebhookUrl) return;
    setCreatingWebhook(true); setNewWebhookSecret(null);
    try {
      const res = await fetch("/api/webhooks", { method: "POST", headers: getAuthHeaders(session), body: JSON.stringify({ url: newWebhookUrl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewWebhookSecret(data.secret); setNewWebhookUrl("");
      const rr = await fetch("/api/webhooks", { headers: getAuthHeaders(session) });
      const rd = await rr.json(); setWebhooks(rd.webhooks || []);
    } catch (err: any) { alert(err.message); } finally { setCreatingWebhook(false); }
  }

  async function handleDeleteWebhook(id: string) {
    if (!session || !confirm("Delete this webhook?")) return;
    await fetch("/api/webhooks", { method: "DELETE", headers: getAuthHeaders(session), body: JSON.stringify({ id }) });
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }

  async function handleUpgrade(plan: "pro" | "enterprise") {
    if (!session) return;
    setUpgrading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", headers: getAuthHeaders(session), body: JSON.stringify({ plan }) });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; } else { alert(data.error || "Failed"); }
    } catch { alert("Network error"); } finally { setUpgrading(null); }
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" /></div>;

  const currentPlan = profile?.plan || "starter";
  const planInfo = PLAN_DETAILS[currentPlan as keyof typeof PLAN_DETAILS];

  return (
    <div className="max-w-[1400px] mx-auto animate-fade-in">
      {/* Tabs */}
      <div className="glass rounded-xl mb-6 overflow-hidden">
        <div className="flex border-b" style={{ borderColor: "var(--ds-border)" }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3.5 text-[14px] font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? "text-[#0D9488] border-[#0D9488]"
                  : "text-[#697386] border-transparent hover:text-[#1A1F36]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrade success banner */}
      {upgradeSuccess && (
        <div className="mb-6 rounded-xl px-5 py-4 flex items-center gap-3 animate-fade-in" style={{ background: "rgba(10,207,131,0.08)", border: "1px solid rgba(10,207,131,0.25)" }}>
          <span className="text-2xl">🎉</span>
          <div className="flex-1">
            <div className="font-semibold text-[#0ACF83]">Welcome to {PLAN_DETAILS[upgradeSuccess as keyof typeof PLAN_DETAILS]?.name || upgradeSuccess}!</div>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--ds-muted)" }}>Your plan has been upgraded. New limits are active immediately.</p>
          </div>
          <button onClick={() => setUpgradeSuccess(null)} className="text-[#8792A2] hover:text-[#1A1F36] text-lg">×</button>
        </div>
      )}

      {/* ═══ BILLING TAB ═══ */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Current Plan Card */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-[20px] font-semibold mb-5" style={{ color: "var(--ds-text)" }}>Current Plan</h2>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="grid grid-cols-2 gap-x-12 gap-y-4 flex-1">
                <div>
                  <div className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Price</div>
                  <div className="text-[16px] font-semibold" style={{ color: "var(--ds-text)" }}>{planInfo.price}</div>
                </div>
                <div>
                  <div className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Properties</div>
                  <div className="text-[16px] font-semibold" style={{ color: "var(--ds-text)" }}>{profile?.properties_used || 0} / {profile?.properties_limit || 1}</div>
                </div>
                <div>
                  <div className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Email</div>
                  <div className="text-[16px] font-semibold" style={{ color: "var(--ds-text)" }}>{profile?.email}</div>
                </div>
                <div>
                  <div className="text-[14px]" style={{ color: "var(--ds-muted)" }}>Company</div>
                  <div className="text-[16px] font-semibold" style={{ color: "var(--ds-text)" }}>{profile?.company_name || "—"}</div>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-[14px] font-semibold" style={{
                background: currentPlan === "enterprise" ? "rgba(223,27,65,0.1)" : currentPlan === "pro" ? "rgba(13,148,136,0.1)" : "rgba(135,146,162,0.15)",
                color: currentPlan === "enterprise" ? "#DF1B41" : currentPlan === "pro" ? "#0D9488" : "#8792A2",
              }}>
                {planInfo.name}
              </span>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(Object.entries(PLAN_DETAILS) as [string, typeof PLAN_DETAILS["starter"]][]).map(([key, plan]) => {
              const isCurrent = key === currentPlan;
              const canUpgrade = !isCurrent && (
                (key === "pro" && currentPlan === "starter") ||
                (key === "enterprise" && (currentPlan === "starter" || currentPlan === "pro"))
              );
              return (
                <div key={key} className="glass rounded-xl p-6 relative" style={isCurrent ? { borderColor: "#0D9488", borderWidth: 2 } : {}}>
                  {key === "pro" && !isCurrent && (
                    <span className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide" style={{ background: "rgba(255,165,0,0.1)", color: "#FFA500" }}>Popular</span>
                  )}
                  {isCurrent && (
                    <span className="absolute top-5 right-5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide" style={{ background: "rgba(13,148,136,0.1)", color: "#0D9488" }}>Current</span>
                  )}
                  <div className={`text-[14px] font-medium mb-2 ${plan.color}`}>{plan.name}</div>
                  <div className="text-[36px] font-bold mb-6" style={{ color: "var(--ds-text)" }}>{plan.price}</div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-[14px]" style={{ color: "var(--ds-text-secondary)" }}>
                        <span className="text-[#0ACF83] font-semibold flex-shrink-0">✓</span> {f}
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
                    <div className="w-full text-center py-2.5 text-[14px] border-t" style={{ borderColor: "var(--ds-border)", color: "var(--ds-muted)" }}>Your current plan</div>
                  ) : (
                    <div className="w-full text-center py-2.5 text-[14px]" style={{ color: "var(--ds-muted)" }}>—</div>
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
          <div className="glass rounded-xl p-6">
            <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--ds-text)" }}>REST API Keys</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--ds-muted)" }}>Authenticate programmatic access to the DeedSlice API</p>

            {profile?.plan !== "enterprise" ? (
              <div className="rounded-lg p-4 border text-[14px]" style={{ background: "rgba(255,165,0,0.05)", borderColor: "rgba(255,165,0,0.2)", color: "var(--ds-text-secondary)" }}>
                ⚡ API access requires an Enterprise plan. <button onClick={() => handleUpgrade("enterprise")} className="text-[#0D9488] font-medium hover:underline ml-1">Upgrade now →</button>
              </div>
            ) : (
              <>
                {newKeyRaw && (
                  <div className="rounded-lg p-4 mb-4 animate-fade-in" style={{ background: "rgba(10,207,131,0.06)", border: "1px solid rgba(10,207,131,0.2)" }}>
                    <div className="text-[13px] text-[#0ACF83] font-medium mb-2">🔑 New API Key — Copy now, won't be shown again</div>
                    <div className="rounded-lg px-3 py-2 font-mono text-[13px] break-all select-all" style={{ background: "var(--ds-bg)" }}>{newKeyRaw}</div>
                  </div>
                )}
                {apiKeys.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {apiKeys.map(k => (
                      <div key={k.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "var(--ds-bg)" }}>
                        <div><span className="font-mono text-[13px]">{k.key_prefix}...</span><span className="text-[13px] ml-3" style={{ color: "var(--ds-muted)" }}>{k.name}</span></div>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px]" style={{ color: "var(--ds-muted)" }}>{k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : "Never used"}</span>
                          <button onClick={() => handleDeleteApiKey(k.id)} className="text-[12px] text-[#DF1B41] hover:underline">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="Key name (e.g. Production)" className="flex-1 border rounded-lg px-4 py-2.5 text-[14px] focus:outline-none focus:border-[#0D9488] transition" style={{ background: "white", borderColor: "var(--ds-border)" }} />
                  <button onClick={handleCreateApiKey} disabled={creatingKey} className="text-white font-medium px-5 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50" style={{ background: "#0ab4aa" }}>{creatingKey ? "..." : "Create Key"}</button>
                </div>
                <div className="mt-5 pt-4 border-t text-[13px]" style={{ borderColor: "var(--ds-border)", color: "var(--ds-muted)" }}>
                  <strong style={{ color: "var(--ds-text-secondary)" }}>Base URL:</strong> <code className="font-mono" style={{ color: "var(--ds-text)" }}>https://console.deedslice.com/api/v1</code><br />
                  <strong style={{ color: "var(--ds-text-secondary)" }}>Auth:</strong> <code className="font-mono" style={{ color: "var(--ds-text)" }}>Authorization: Bearer ds_live_...</code><br />
                  <strong style={{ color: "var(--ds-text-secondary)" }}>Endpoints:</strong> GET /properties · GET /properties/:id · GET /properties/:id/investors · GET /properties/:id/audit
                </div>
              </>
            )}
          </div>

          {/* Webhooks */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--ds-text)" }}>Webhooks</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--ds-muted)" }}>Receive real-time notifications when events occur</p>

            {profile?.plan !== "enterprise" ? (
              <div className="rounded-lg p-4 border text-[14px]" style={{ background: "rgba(255,165,0,0.05)", borderColor: "rgba(255,165,0,0.2)", color: "var(--ds-text-secondary)" }}>
                ⚡ Webhooks require an Enterprise plan.
              </div>
            ) : (
              <>
                {newWebhookSecret && (
                  <div className="rounded-lg p-4 mb-4 animate-fade-in" style={{ background: "rgba(10,207,131,0.06)", border: "1px solid rgba(10,207,131,0.2)" }}>
                    <div className="text-[13px] text-[#0ACF83] font-medium mb-2">🔗 Webhook Created — Save the signing secret</div>
                    <div className="rounded-lg px-3 py-2 font-mono text-[13px] break-all select-all" style={{ background: "var(--ds-bg)" }}>{newWebhookSecret}</div>
                    <p className="text-[12px] mt-1" style={{ color: "var(--ds-muted)" }}>Verify payloads with HMAC-SHA256 (X-DeedSlice-Signature header)</p>
                  </div>
                )}
                {webhooks.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {webhooks.map(w => (
                      <div key={w.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: "var(--ds-bg)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[13px] truncate">{w.url}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${w.active ? "bg-[#0ACF83]" : "bg-[#DF1B41]"}`} />
                            <span className="text-[12px]" style={{ color: "var(--ds-muted)" }}>{w.active ? "Active" : `Disabled (${w.failure_count} failures)`}</span>
                          </div>
                        </div>
                        <button onClick={() => handleDeleteWebhook(w.id)} className="text-[12px] text-[#DF1B41] hover:underline ml-3 shrink-0">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input type="url" value={newWebhookUrl} onChange={e => setNewWebhookUrl(e.target.value)} placeholder="https://your-app.com/webhook" className="flex-1 border rounded-lg px-4 py-2.5 text-[14px] font-mono focus:outline-none focus:border-[#0D9488] transition" style={{ background: "white", borderColor: "var(--ds-border)" }} />
                  <button onClick={handleCreateWebhook} disabled={creatingWebhook || !newWebhookUrl} className="text-white font-medium px-5 py-2.5 rounded-lg text-[14px] transition-all disabled:opacity-50" style={{ background: "#0ab4aa" }}>{creatingWebhook ? "..." : "Add Webhook"}</button>
                </div>
                <div className="mt-4 text-[13px]" style={{ color: "var(--ds-muted)" }}>
                  <strong style={{ color: "var(--ds-text-secondary)" }}>Events:</strong> property.tokenized · investor.added/updated · transfer.completed/failed · document.added · kyc.updated · distribution.*<br />
                  Max 5 webhooks. Auto-disabled after 10 consecutive failures.
                </div>
              </>
            )}
          </div>

          {/* White-Label */}
          {profile?.plan === "enterprise" && session && <WhiteLabelSettings session={session} />}
        </div>
      )}

      {/* ═══ SECURITY TAB ═══ */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h2 className="text-[20px] font-semibold mb-1" style={{ color: "var(--ds-text)" }}>Two-Factor Authentication</h2>
            <p className="text-[14px] mb-5" style={{ color: "var(--ds-muted)" }}>Add an extra layer of security to your account</p>
            <div className="rounded-lg p-4 flex items-start gap-3" style={{ background: "rgba(13,148,136,0.04)", border: "1px solid rgba(13,148,136,0.15)" }}>
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="#0D9488" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-[14px]" style={{ color: "var(--ds-text-secondary)" }}>
                Two-factor authentication is currently disabled. This feature is coming soon.
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass rounded-xl p-6" style={{ borderColor: "rgba(223,27,65,0.2)" }}>
            <h2 className="text-[20px] font-semibold mb-2" style={{ color: "#DF1B41" }}>Danger Zone</h2>
            <p className="text-[14px] mb-4" style={{ color: "var(--ds-text-secondary)" }}>
              Once you delete your account, all your properties, investors, and distribution data will be permanently deleted.
            </p>
            <a
              href="mailto:support@deedslice.com?subject=Account%20Deletion%20Request"
              className="inline-block text-[14px] font-medium px-5 py-2.5 rounded-lg transition-all hover:shadow-sm"
              style={{ color: "#DF1B41", border: "1px solid rgba(223,27,65,0.3)", background: "white" }}
            >
              Request Account Deletion
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
