"use client";

/**
 * WhiteLabelSettings — Organization + Branding + Custom Domain management
 *
 * Appears in Settings page for Enterprise users.
 * Manages: org creation, branding customization, domain setup, LP portal preview.
 */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";

interface OrgData {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_verified: boolean;
  domain_verification_token: string | null;
}

interface BrandingData {
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  bg_color: string;
  email_sender_name: string | null;
  portal_title: string | null;
  footer_text: string | null;
  show_powered_by: boolean;
}

interface SettingsData {
  require_kyc_for_transfer: boolean;
  allow_investor_self_register: boolean;
  default_property_visibility: string;
  timezone: string;
  currency: string;
}

const DEFAULT_BRANDING: BrandingData = {
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  primary_color: "#0D9488",
  secondary_color: "#0F172A",
  accent_color: "#6366F1",
  text_color: "#0F172A",
  bg_color: "#F8FAFC",
  email_sender_name: null,
  portal_title: null,
  footer_text: "Powered by DeedSlice",
  show_powered_by: true,
};

interface Props {
  session: any;
}

export default function WhiteLabelSettings({ session }: Props) {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [branding, setBranding] = useState<BrandingData>(DEFAULT_BRANDING);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // Create org form
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Domain
  const [customDomain, setCustomDomain] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  useEffect(() => {
    loadOrg();
  }, [session]);

  async function loadOrg() {
    try {
      const res = await fetch("/api/org?includeVerification=1", { headers: getAuthHeaders(session) });
      const data = await res.json();
      if (data.org) {
        setOrg(data.org);
        setBranding({ ...DEFAULT_BRANDING, ...data.branding });
        setSettings(data.settings);
        setCustomDomain(data.org.custom_domain || "");
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/org", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrg(data.org);
      setBranding(DEFAULT_BRANDING);
      loadOrg();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveBranding() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/org", {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({
          branding: {
            logo_url: branding.logo_url,
            logo_dark_url: branding.logo_dark_url,
            favicon_url: branding.favicon_url,
            primary_color: branding.primary_color,
            secondary_color: branding.secondary_color,
            accent_color: branding.accent_color,
            text_color: branding.text_color,
            bg_color: branding.bg_color,
            email_sender_name: branding.email_sender_name,
            portal_title: branding.portal_title,
            footer_text: branding.footer_text,
            show_powered_by: branding.show_powered_by,
          },
          settings: settings ? {
            require_kyc_for_transfer: settings.require_kyc_for_transfer,
            allow_investor_self_register: settings.allow_investor_self_register,
          } : undefined,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(null), 2000);
    } catch {
      setSaveMsg("Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDomain() {
    setSaving(true);
    try {
      await fetch("/api/org", {
        method: "PATCH",
        headers: getAuthHeaders(session),
        body: JSON.stringify({ custom_domain: customDomain || null }),
      });
      loadOrg();
    } catch {} finally {
      setSaving(false);
    }
  }

  async function handleVerifyDomain() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/org/verify-domain", {
        method: "POST",
        headers: getAuthHeaders(session),
      });
      const data = await res.json();
      setVerifyResult(data);
      if (data.verified) loadOrg();
    } catch {
      setVerifyResult({ message: "Verification request failed." });
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 mt-8">
        <h2 className="font-semibold mb-4">White-Label Portal</h2>
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ── No org yet: creation form ──
  if (!org) {
    return (
      <div className="glass rounded-2xl p-6 mt-8">
        <h2 className="font-semibold mb-1">White-Label Portal</h2>
        <p className="text-xs text-ds-muted mb-5">Set up your branded investor portal. Your investors will never see "DeedSlice".</p>

        <form onSubmit={handleCreateOrg} className="space-y-4 max-w-md">
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 text-ds-muted tracking-wide uppercase">Organization Name</label>
            <input
              type="text"
              value={newOrgName}
              onChange={e => setNewOrgName(e.target.value)}
              placeholder="e.g. Smith Capital Partners"
              required
              className="w-full bg-ds-bg border border-ds-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold mb-1.5 text-ds-muted tracking-wide uppercase">Portal Slug</label>
            <div className="flex items-center gap-0">
              <span className="text-xs text-ds-muted bg-ds-bg border border-r-0 border-ds-border rounded-l-lg px-3 py-2.5">
                console.deedslice.com/portal/
              </span>
              <input
                type="text"
                value={newOrgSlug}
                onChange={e => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="smith-capital"
                required
                className="flex-1 bg-ds-bg border border-ds-border rounded-r-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ds-accent transition"
              />
            </div>
            <p className="text-[10px] text-ds-muted mt-1">Lowercase letters, numbers, and hyphens only. 3-50 characters.</p>
          </div>

          {createError && (
            <div className="text-[12px] bg-ds-red/5 text-ds-red rounded-lg px-3 py-2">{createError}</div>
          )}

          <button
            type="submit"
            disabled={creating || !newOrgName || !newOrgSlug}
            className="text-white font-semibold px-5 py-2.5 rounded-lg text-[13px] transition-all disabled:opacity-50"
            style={{ background: "#0ab4aa", boxShadow: "0 1px 3px rgba(13,148,136,0.2)" }}
          >
            {creating ? "Creating..." : "Create Organization"}
          </button>
        </form>
      </div>
    );
  }

  // ── Org exists: management UI ──
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://console.deedslice.com";
  const portalUrl = org.custom_domain && org.domain_verified
    ? `https://${org.custom_domain}`
    : `${appUrl}/portal/${org.slug}`;

  return (
    <div className="space-y-6 mt-8">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">White-Label Portal</h2>
            <p className="text-xs text-ds-muted mt-0.5">Your branded investor portal is live.</p>
          </div>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium px-3.5 py-2 rounded-lg border transition-all"
            style={{ color: "#0D9488", borderColor: "rgba(13,148,136,0.25)" }}
          >
            Open Portal ↗
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-ds-bg rounded-lg px-3 py-2.5">
            <span className="text-ds-muted">Organization</span>
            <div className="font-medium mt-0.5">{org.name}</div>
          </div>
          <div className="bg-ds-bg rounded-lg px-3 py-2.5">
            <span className="text-ds-muted">Portal URL</span>
            <div className="font-mono font-medium mt-0.5 truncate">{portalUrl.replace("https://", "")}</div>
          </div>
          <div className="bg-ds-bg rounded-lg px-3 py-2.5">
            <span className="text-ds-muted">Custom Domain</span>
            <div className="font-medium mt-0.5 flex items-center gap-1.5">
              {org.custom_domain ? (
                <>
                  {org.custom_domain}
                  {org.domain_verified ? (
                    <span className="text-[10px] bg-ds-green/15 text-ds-green px-1.5 py-0.5 rounded">✓ Verified</span>
                  ) : (
                    <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">Pending</span>
                  )}
                </>
              ) : (
                <span className="text-ds-muted">Not configured</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Branding Configuration */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold">Branding</h2>
            <p className="text-xs text-ds-muted mt-0.5">Customize how your portal looks to investors.</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-[11px] font-medium ${saveMsg === "Saved" ? "text-ds-green" : "text-ds-red"}`}>
                {saveMsg}
              </span>
            )}
            <button
              onClick={handleSaveBranding}
              disabled={saving}
              className="text-white font-semibold px-4 py-2 rounded-lg text-[12px] transition-all disabled:opacity-50"
              style={{ background: "#0ab4aa" }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: text fields */}
          <div className="space-y-4">
            <Field
              label="Portal Title"
              value={branding.portal_title || ""}
              onChange={v => setBranding(b => ({ ...b, portal_title: v || null }))}
              placeholder="e.g. Smith Capital Investor Portal"
            />
            <Field
              label="Email Sender Name"
              value={branding.email_sender_name || ""}
              onChange={v => setBranding(b => ({ ...b, email_sender_name: v || null }))}
              placeholder="e.g. Smith Capital"
              hint="Used in magic link emails instead of 'DeedSlice'"
            />
            <Field
              label="Logo URL (Light Mode)"
              value={branding.logo_url || ""}
              onChange={v => setBranding(b => ({ ...b, logo_url: v || null }))}
              placeholder="https://yoursite.com/logo.png"
              hint="Dark logo for light backgrounds. Recommended: 200×40px transparent PNG"
            />
            <Field
              label="Logo URL (Dark Mode)"
              value={branding.logo_dark_url || ""}
              onChange={v => setBranding(b => ({ ...b, logo_dark_url: v || null }))}
              placeholder="https://yoursite.com/logo-white.png"
              hint="Light/white logo for dark backgrounds. If empty, light-mode logo is used everywhere."
            />
            <Field
              label="Favicon URL"
              value={branding.favicon_url || ""}
              onChange={v => setBranding(b => ({ ...b, favicon_url: v || null }))}
              placeholder="https://yoursite.com/favicon.ico"
            />
            <Field
              label="Footer Text"
              value={branding.footer_text || ""}
              onChange={v => setBranding(b => ({ ...b, footer_text: v || null }))}
              placeholder="Powered by DeedSlice"
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={branding.show_powered_by}
                onChange={e => setBranding(b => ({ ...b, show_powered_by: e.target.checked }))}
                className="w-4 h-4 rounded accent-[#0ab4aa]"
              />
              <label className="text-[12px] text-ds-text-secondary">Show &quot;Powered by&quot; footer</label>
            </div>
          </div>

          {/* Right: color pickers */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-ds-muted tracking-wide uppercase mb-2">Colors</p>
            <ColorPicker label="Primary" value={branding.primary_color} onChange={v => setBranding(b => ({ ...b, primary_color: v }))} />
            <ColorPicker label="Secondary" value={branding.secondary_color} onChange={v => setBranding(b => ({ ...b, secondary_color: v }))} />
            <ColorPicker label="Accent" value={branding.accent_color} onChange={v => setBranding(b => ({ ...b, accent_color: v }))} />
            <ColorPicker label="Text" value={branding.text_color} onChange={v => setBranding(b => ({ ...b, text_color: v }))} />
            <ColorPicker label="Background" value={branding.bg_color} onChange={v => setBranding(b => ({ ...b, bg_color: v }))} />

            {/* Live preview mini card */}
            <div className="mt-4 pt-4 border-t border-ds-border">
              <p className="text-[10px] text-ds-muted mb-2 uppercase tracking-wide font-medium">Preview</p>
              <div
                className="rounded-lg border p-4"
                style={{
                  background: branding.bg_color,
                  borderColor: "#E2E8F0",
                  color: branding.text_color,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  {branding.logo_url ? (
                    <img src={branding.logo_url} alt="" className="h-5 w-auto" onError={e => (e.currentTarget.style.display = "none")} />
                  ) : (
                    <span className="text-[12px] font-bold" style={{ color: branding.primary_color }}>
                      {org.name}
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-semibold mb-2" style={{ color: branding.text_color }}>
                  Portfolio
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-md p-2" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid #E2E8F0" }}>
                    <div className="text-[9px]" style={{ color: "#94A3B8" }}>Value</div>
                    <div className="text-[13px] font-bold" style={{ color: branding.text_color }}>$250,000</div>
                  </div>
                  <div className="flex-1 rounded-md p-2" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid #E2E8F0" }}>
                    <div className="text-[9px]" style={{ color: "#94A3B8" }}>Ownership</div>
                    <div className="text-[13px] font-bold" style={{ color: branding.text_color }}>15%</div>
                  </div>
                </div>
                <button
                  className="mt-2 w-full text-[10px] font-semibold py-1.5 rounded-md text-white"
                  style={{ background: branding.primary_color }}
                >
                  View Property →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Org Settings */}
        {settings && (
          <div className="mt-6 pt-5 border-t border-ds-border">
            <p className="text-[11px] font-semibold text-ds-muted tracking-wide uppercase mb-3">Portal Settings</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.require_kyc_for_transfer}
                  onChange={e => setSettings(s => s ? { ...s, require_kyc_for_transfer: e.target.checked } : s)}
                  className="w-4 h-4 rounded accent-[#0ab4aa]"
                />
                <label className="text-[12px] text-ds-text-secondary">Require KYC verification before token transfers</label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.allow_investor_self_register}
                  onChange={e => setSettings(s => s ? { ...s, allow_investor_self_register: e.target.checked } : s)}
                  className="w-4 h-4 rounded accent-[#0ab4aa]"
                />
                <label className="text-[12px] text-ds-text-secondary">Allow investors to self-register (vs invite-only)</label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Domain */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-semibold mb-1">Custom Domain</h2>
        <p className="text-xs text-ds-muted mb-4">
          Serve your investor portal on your own domain. No "DeedSlice" in the URL.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={customDomain}
            onChange={e => setCustomDomain(e.target.value.toLowerCase().trim())}
            placeholder="invest.yourcompany.com"
            className="flex-1 bg-ds-bg border border-ds-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ds-accent transition"
          />
          <button
            onClick={handleSetDomain}
            disabled={saving}
            className="text-white font-medium px-4 py-2.5 rounded-lg text-[12px] transition-all disabled:opacity-50"
            style={{ background: "#0ab4aa" }}
          >
            {saving ? "..." : "Set Domain"}
          </button>
        </div>

        {org.custom_domain && !org.domain_verified && (
          <div className="bg-ds-bg rounded-xl p-4 mt-3">
            <p className="text-[12px] font-medium mb-2" style={{ color: "#D97706" }}>⚠ Domain not verified</p>
            <p className="text-[11px] text-ds-muted mb-3">Add one of these DNS records to verify ownership:</p>

            <div className="space-y-3 text-[11px]">
              <div className="bg-white rounded-lg border border-ds-border p-3">
                <div className="font-semibold text-ds-text mb-1">Option 1: TXT Record</div>
                <div className="font-mono text-[10px] space-y-1 text-ds-muted">
                  <div>Host: <span className="text-ds-text">_deedslice-verify.{org.custom_domain}</span></div>
                  <div>Value: <span className="text-ds-text select-all">ds-verify={org.domain_verification_token}</span></div>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-ds-border p-3">
                <div className="font-semibold text-ds-text mb-1">Option 2: CNAME Record</div>
                <div className="font-mono text-[10px] space-y-1 text-ds-muted">
                  <div>Host: <span className="text-ds-text">{org.custom_domain}</span></div>
                  <div>Value: <span className="text-ds-text">portal.deedslice.com</span></div>
                </div>
              </div>
            </div>

            <button
              onClick={handleVerifyDomain}
              disabled={verifying}
              className="mt-3 text-[12px] font-semibold px-4 py-2 rounded-lg border transition-all disabled:opacity-50"
              style={{ color: "#0D9488", borderColor: "rgba(13,148,136,0.25)" }}
            >
              {verifying ? "Checking DNS..." : "Verify Domain"}
            </button>

            {verifyResult && (
              <div className={`mt-2 text-[11px] px-3 py-2 rounded-lg ${verifyResult.verified ? "bg-ds-green/10 text-ds-green" : "bg-ds-red/5 text-ds-red"}`}>
                {verifyResult.message}
              </div>
            )}
          </div>
        )}

        {org.custom_domain && org.domain_verified && (
          <div className="space-y-3 mt-3">
            <div className="bg-ds-green/5 rounded-lg px-4 py-3 flex items-center gap-2">
              <span className="text-ds-green text-[13px]">✓</span>
              <span className="text-[12px] text-ds-green font-medium">Domain verified and active</span>
            </div>

            {/* Setup completion checklist */}
            <div className="bg-ds-bg rounded-xl p-4">
              <p className="text-[11px] font-semibold text-ds-muted tracking-wide uppercase mb-3">Setup Checklist</p>
              <div className="space-y-2.5">
                <SetupStep done label="Set custom domain" detail={org.custom_domain} />
                <SetupStep done label="Verify DNS ownership" detail="TXT or CNAME verified" />
                <SetupStep
                  done={false}
                  label="Add domain in Vercel"
                  detail={
                    <span>
                      Go to your{" "}
                      <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "#0D9488" }}>
                        Vercel project settings
                      </a>
                      {" "}→ Domains → Add &quot;{org.custom_domain}&quot;. Vercel needs this to accept traffic.
                    </span>
                  }
                />
                <SetupStep
                  done={false}
                  label="Add CNAME record"
                  detail={
                    <span className="font-mono text-[10px]">
                      {org.custom_domain} → CNAME → cname.vercel-dns.com
                    </span>
                  }
                />
                <SetupStep
                  done={false}
                  label="Wait for SSL (automatic)"
                  detail="Vercel provisions a free SSL certificate. Usually takes 1-5 minutes."
                />
              </div>
              <div className="mt-3 pt-3 border-t border-ds-border">
                <p className="text-[10px] text-ds-muted leading-relaxed">
                  After all steps are complete, <strong className="text-ds-text-secondary">{org.custom_domain}</strong> will serve your
                  investor portal with full SSL. Your investors will never see &quot;deedslice.com&quot; in their browser.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold mb-1.5 text-ds-muted tracking-wide uppercase">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ds-bg border border-ds-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
      />
      {hint && <p className="text-[10px] text-ds-muted mt-1">{hint}</p>}
    </div>
  );
}

function SetupStep({
  done,
  label,
  detail,
}: {
  done: boolean;
  label: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5.5L4 7.5L8 3" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: "#CBD5E1" }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[12px] font-medium ${done ? "text-ds-muted line-through" : "text-ds-text"}`}>
          {label}
        </div>
        {!done && detail && (
          <div className="text-[11px] text-ds-muted mt-0.5 leading-relaxed">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border border-ds-border cursor-pointer p-0.5"
        style={{ background: "#fff" }}
      />
      <div className="flex-1 flex items-center justify-between">
        <span className="text-[12px] text-ds-text-secondary">{label}</span>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-20 text-[11px] font-mono text-right bg-transparent border-none focus:outline-none text-ds-text"
        />
      </div>
    </div>
  );
}
