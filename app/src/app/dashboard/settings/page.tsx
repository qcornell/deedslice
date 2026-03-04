"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";
import type { Profile, ApiKey, Webhook } from "@/types/database";
import WhiteLabelSettings from "@/components/WhiteLabelSettings";

const PLAN_DETAILS = {
  starter: { name: "Starter", price: "Free", color: "text-ds-muted", properties: "1 property", features: ["1 property (testnet sandbox)", "NFT deed + share tokens", "Basic dashboard", "HCS audit log", "Try before you buy"] },
  pro: { name: "Pro", price: "$99.99/mo", color: "text-ds-accent-text", properties: "5 properties", features: ["5 properties (mainnet)", "Full investor dashboard", "Document vault (SHA-256 → HCS)", "Investor management", "Token transfers to wallets", "Email support", "+$199 per additional tokenization"] },
  enterprise: { name: "Enterprise", price: "$499.99/mo", color: "text-ds-orange", properties: "Unlimited", features: ["Unlimited properties", "REST API access", "Priority support", "Custom integrations", "Webhooks", "White-label investor portal"] },
};

export default function SettingsPage() {
  const { session, user } = useAuth();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState<string | null>(null);

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

  // Load API keys + webhooks for Enterprise users
  useEffect(() => {
    if (!session || !profile || profile.plan !== "enterprise") return;
    fetch("/api/api-keys", { headers: getAuthHeaders(session) })
      .then(r => r.json())
      .then(d => setApiKeys(d.keys || []))
      .catch(() => {});
    fetch("/api/webhooks", { headers: getAuthHeaders(session) })
      .then(r => r.json())
      .then(d => setWebhooks(d.webhooks || []))
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
      // Refresh keys list
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
    if (!session || !confirm("Delete this API key? Any integrations using it will stop working.")) return;
    await fetch("/api/api-keys", {
      method: "DELETE",
      headers: getAuthHeaders(session),
      body: JSON.stringify({ id }),
    });
    setApiKeys(prev => prev.filter(k => k.id !== id));
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
    await fetch("/api/webhooks", {
      method: "DELETE",
      headers: getAuthHeaders(session),
      body: JSON.stringify({ id }),
    });
    setWebhooks(prev => prev.filter(w => w.id !== id));
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

      {/* API Keys — Enterprise only */}
      {profile?.plan === "enterprise" && (
        <div className="mt-8 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">REST API Keys</h2>
              <p className="text-xs text-ds-muted mt-0.5">Authenticate programmatic access to the DeedSlice API</p>
            </div>
          </div>

          {/* Show newly created key */}
          {newKeyRaw && (
            <div className="bg-ds-green/10 border border-ds-green/30 rounded-xl p-4 mb-4 animate-fade-in">
              <div className="text-xs text-ds-green font-medium mb-2">🔑 New API Key Created — Copy it now, it won't be shown again</div>
              <div className="bg-ds-bg rounded-lg px-3 py-2 font-mono text-xs break-all select-all">{newKeyRaw}</div>
              <button onClick={() => { try { navigator.clipboard.writeText(newKeyRaw); } catch {} }} className="mt-2 text-[10px] text-ds-accent-text hover:underline">Copy to clipboard</button>
            </div>
          )}

          {/* Key list */}
          {apiKeys.length > 0 && (
            <div className="space-y-2 mb-4">
              {apiKeys.map(k => (
                <div key={k.id} className="flex items-center justify-between bg-ds-bg rounded-lg px-4 py-2.5">
                  <div>
                    <span className="font-mono text-xs">{k.key_prefix}...</span>
                    <span className="text-xs text-ds-muted ml-3">{k.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-ds-muted">{k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : "Never used"}</span>
                    <button onClick={() => handleDeleteApiKey(k.id)} className="text-[10px] text-ds-red hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create new key */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ds-accent transition"
            />
            <button
              onClick={handleCreateApiKey}
              disabled={creatingKey}
              className="text-white font-medium px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{ background: "#0D9488" }}
            >
              {creatingKey ? "..." : "Create Key"}
            </button>
          </div>

          {/* API docs hint */}
          <div className="mt-4 pt-3 border-t border-ds-border text-xs text-ds-muted">
            <strong>Base URL:</strong> <code className="font-mono text-ds-text">https://console.deedslice.com/api/v1</code>
            <div className="mt-1">
              <strong>Auth:</strong> <code className="font-mono text-ds-text">Authorization: Bearer ds_live_...</code>
            </div>
            <div className="mt-1">
              <strong>Endpoints:</strong> GET /properties · GET /properties/:id · GET /properties/:id/investors · GET /properties/:id/audit
            </div>
          </div>
        </div>
      )}

      {/* Webhooks — Enterprise only */}
      {profile?.plan === "enterprise" && (
        <div className="mt-6 glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold">Webhooks</h2>
              <p className="text-xs text-ds-muted mt-0.5">Receive real-time notifications when events occur</p>
            </div>
          </div>

          {/* Show newly created webhook secret */}
          {newWebhookSecret && (
            <div className="bg-ds-green/10 border border-ds-green/30 rounded-xl p-4 mb-4 animate-fade-in">
              <div className="text-xs text-ds-green font-medium mb-2">🔗 Webhook Created — Save the signing secret</div>
              <div className="bg-ds-bg rounded-lg px-3 py-2 font-mono text-xs break-all select-all">{newWebhookSecret}</div>
              <p className="text-[10px] text-ds-muted mt-1">Use this secret to verify payloads with HMAC-SHA256 (X-DeedSlice-Signature header)</p>
            </div>
          )}

          {/* Webhook list */}
          {webhooks.length > 0 && (
            <div className="space-y-2 mb-4">
              {webhooks.map(w => (
                <div key={w.id} className="flex items-center justify-between bg-ds-bg rounded-lg px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs truncate">{w.url}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${w.active ? "bg-ds-green" : "bg-ds-red"}`} />
                      <span className="text-[10px] text-ds-muted">{w.active ? "Active" : `Disabled (${w.failure_count} failures)`}</span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteWebhook(w.id)} className="text-[10px] text-ds-red hover:underline ml-3 shrink-0">Delete</button>
                </div>
              ))}
            </div>
          )}

          {/* Create new webhook */}
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={newWebhookUrl}
              onChange={e => setNewWebhookUrl(e.target.value)}
              placeholder="https://your-app.com/webhook"
              className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-ds-accent transition"
            />
            <button
              onClick={handleCreateWebhook}
              disabled={creatingWebhook || !newWebhookUrl}
              className="text-white font-medium px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{ background: "#0D9488" }}
            >
              {creatingWebhook ? "..." : "Add Webhook"}
            </button>
          </div>

          <div className="mt-3 text-[10px] text-ds-muted">
            <strong>Events:</strong> property.tokenized · investor.added · investor.updated · transfer.completed · transfer.failed · document.added · kyc.updated
          </div>
          <div className="mt-1 text-[10px] text-ds-muted">
            Max 5 webhooks. Auto-disabled after 10 consecutive failures.
          </div>
        </div>
      )}

      {/* White-Label Settings — Enterprise only */}
      {profile?.plan === "enterprise" && session && (
        <WhiteLabelSettings session={session} />
      )}

      {/* Danger Zone */}
      <div className="mt-12 glass rounded-2xl p-6 border-ds-red/20">
        <h2 className="font-semibold text-ds-red mb-2">Danger Zone</h2>
        <p className="text-sm text-ds-muted mb-4">Need to delete your account? Contact us and we'll handle it.</p>
        <a
          href="mailto:support@deedslice.com?subject=Account%20Deletion%20Request"
          className="inline-block text-sm text-ds-red border border-ds-red/30 px-4 py-2 rounded-lg hover:bg-ds-red/10 transition"
        >
          Request Account Deletion
        </a>
      </div>
    </div>
  );
}
