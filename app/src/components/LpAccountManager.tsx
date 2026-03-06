"use client";

/**
 * LpAccountManager — Manage LP (investor) portal accounts
 *
 * Features:
 *   - List all LP accounts for the org
 *   - Create new LP account (+ send invite email)
 *   - Link LP to existing investor record
 *   - Reset password (sends magic link)
 *   - Delete LP account
 */

import { useEffect, useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";

interface LpAccountData {
  id: string;
  email: string;
  name: string | null;
  investor_id: string | null;
  last_login_at: string | null;
  created_at: string;
  investor: {
    id: string;
    name: string;
    email: string | null;
    slices_owned: number;
    percentage: number;
    property_id: string;
    propertyName: string;
  } | null;
}

interface InvestorOption {
  id: string;
  name: string;
  email: string | null;
  slices_owned: number;
  percentage: number;
  property_id: string;
  _propertyName?: string;
}

interface Props {
  session: any;
}

export default function LpAccountManager({ session }: Props) {
  const [accounts, setAccounts] = useState<LpAccountData[]>([]);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newInvestorId, setNewInvestorId] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const h = getAuthHeaders(session);

  useEffect(() => {
    loadData();
  }, [session]);

  async function loadData() {
    try {
      const [accRes, summaryRes] = await Promise.all([
        fetch("/api/lp/accounts", { headers: h }).then(r => r.json()),
        fetch("/api/dashboard/summary", { headers: h }).then(r => r.json()),
      ]);
      setAccounts(accRes.accounts || []);
      setInvestors(summaryRes.investors || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    setCreating(true);
    setCreateMsg(null);
    try {
      const res = await fetch("/api/lp/accounts", {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName || null,
          password: newPassword || null,
          investorId: newInvestorId || null,
          sendInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCreateMsg({
        type: "ok",
        text: data.inviteSent
          ? `Account created! Invite email sent to ${newEmail}`
          : "Account created (invite email not sent)",
      });
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewInvestorId("");
      setShowCreate(false);
      loadData();
    } catch (err: any) {
      setCreateMsg({ type: "err", text: err.message });
    } finally {
      setCreating(false);
    }
  }

  async function handleResetPassword(accountId: string, email: string) {
    if (!confirm(`Send a password reset email to ${email}?`)) return;
    setActionLoading(accountId);
    try {
      const res = await fetch("/api/lp/accounts", {
        method: "PATCH",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, resetPassword: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.magicLinkSent ? "Password reset email sent!" : "Password cleared (email send failed)");
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(accountId: string, email: string) {
    if (!confirm(`Delete LP account for ${email}? This cannot be undone.`)) return;
    setActionLoading(accountId);
    try {
      const res = await fetch(`/api/lp/accounts?id=${accountId}`, {
        method: "DELETE",
        headers: h,
      });
      if (!res.ok) throw new Error("Delete failed");
      loadData();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResendInvite(accountId: string, email: string) {
    setActionLoading(accountId);
    try {
      const res = await fetch("/api/lp/accounts", {
        method: "PATCH",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, resetPassword: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.magicLinkSent ? `Login link sent to ${email}` : "Failed to send email");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6 mt-6">
        <h2 className="font-semibold mb-4">Investor Portal Accounts</h2>
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Investors that don't yet have an LP account (for linking)
  const unlinkedInvestors = investors.filter(
    inv => !accounts.some(acc => acc.investor_id === inv.id || acc.email === inv.email)
  );

  return (
    <div className="glass rounded-2xl p-6 mt-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold">Investor Portal Accounts</h2>
          <p className="text-xs text-ds-muted mt-0.5">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · Manage who can access your investor portal
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 text-white font-medium px-4 py-2 rounded-lg text-[12px] transition-all hover:shadow-md"
          style={{ background: "#0ab4aa" }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Account
        </button>
      </div>

      {/* Status messages */}
      {createMsg && (
        <div
          className={`mb-4 text-[12px] rounded-lg px-3 py-2 ${
            createMsg.type === "ok" ? "bg-[rgba(10,207,131,0.08)] text-[#0ACF83]" : "bg-[rgba(223,27,65,0.05)] text-[#DF1B41]"
          }`}
        >
          {createMsg.text}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="bg-ds-bg rounded-xl border border-ds-border p-5 mb-5">
          <h3 className="text-[13px] font-semibold mb-3" style={{ color: "#1A1F36" }}>New LP Account</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-ds-muted tracking-wide uppercase mb-1">Email *</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  required
                  placeholder="investor@example.com"
                  className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-ds-accent transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-ds-muted tracking-wide uppercase mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-ds-accent transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-ds-muted tracking-wide uppercase mb-1">Password (optional)</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Leave blank for magic link only"
                  className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-ds-accent transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-ds-muted tracking-wide uppercase mb-1">Link to Investor</label>
                <select
                  value={newInvestorId}
                  onChange={e => setNewInvestorId(e.target.value)}
                  className="w-full bg-white border border-ds-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-ds-accent transition appearance-none"
                >
                  <option value="">Auto-match by email</option>
                  {unlinkedInvestors.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name} — {inv.slices_owned} slices ({inv.percentage}%) {inv._propertyName ? `· ${inv._propertyName}` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-ds-muted mt-1">If blank, the portal auto-matches by email address</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sendInvite}
                onChange={e => setSendInvite(e.target.checked)}
                className="w-4 h-4 rounded accent-[#0ab4aa]"
              />
              <label className="text-[12px] text-ds-text-secondary">Send invite email with login link</label>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={creating || !newEmail}
                className="text-white font-medium px-4 py-2 rounded-lg text-[12px] transition-all disabled:opacity-50"
                style={{ background: "#0ab4aa" }}
              >
                {creating ? "Creating..." : "Create Account"}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg text-[12px] font-medium border transition-all"
                style={{ borderColor: "#E3E8EF", color: "#697386" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: "rgba(135,146,162,0.08)" }}>
            <svg width="24" height="24" fill="none" stroke="#8792A2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-[13px] text-ds-muted">No investor portal accounts yet.</p>
          <p className="text-[11px] text-ds-muted mt-1">Create accounts so your investors can log in and view their portfolio.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "#E3E8EF" }}>
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[12px] font-semibold flex-shrink-0"
                  style={{
                    background: acc.last_login_at
                      ? "linear-gradient(135deg, #0D9488, #0ACF83)"
                      : "linear-gradient(135deg, #8792A2, #B0B8C4)",
                  }}
                >
                  {(acc.name || acc.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: "#1A1F36" }}>
                    {acc.name || acc.email}
                  </div>
                  <div className="text-[11px] text-ds-muted truncate flex items-center gap-2">
                    {acc.email}
                    {acc.investor && (
                      <span className="inline-flex items-center gap-1 bg-[rgba(13,148,136,0.06)] text-[#0D9488] px-1.5 py-0.5 rounded text-[9px] font-medium">
                        {acc.investor.slices_owned} slices · {acc.investor.propertyName}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-ds-muted mt-0.5">
                    {acc.last_login_at
                      ? `Last login: ${new Date(acc.last_login_at).toLocaleDateString()}`
                      : "Never logged in"}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => handleResendInvite(acc.id, acc.email)}
                  disabled={actionLoading === acc.id}
                  title="Send login link"
                  className="p-1.5 rounded-md border transition-all hover:bg-ds-bg disabled:opacity-30"
                  style={{ borderColor: "#E3E8EF" }}
                >
                  <svg width="14" height="14" fill="none" stroke="#697386" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleResetPassword(acc.id, acc.email)}
                  disabled={actionLoading === acc.id}
                  title="Reset password"
                  className="p-1.5 rounded-md border transition-all hover:bg-ds-bg disabled:opacity-30"
                  style={{ borderColor: "#E3E8EF" }}
                >
                  <svg width="14" height="14" fill="none" stroke="#697386" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(acc.id, acc.email)}
                  disabled={actionLoading === acc.id}
                  title="Delete account"
                  className="p-1.5 rounded-md border transition-all hover:bg-[rgba(223,27,65,0.04)] disabled:opacity-30"
                  style={{ borderColor: "#E3E8EF" }}
                >
                  <svg width="14" height="14" fill="none" stroke="#DF1B41" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-invite from existing investors */}
      {unlinkedInvestors.length > 0 && (
        <div className="mt-5 pt-4 border-t" style={{ borderColor: "#E3E8EF" }}>
          <p className="text-[11px] font-semibold text-ds-muted tracking-wide uppercase mb-2">
            Quick Invite — {unlinkedInvestors.length} investor{unlinkedInvestors.length !== 1 ? "s" : ""} without portal access
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinkedInvestors.slice(0, 10).map(inv => (
              <button
                key={inv.id}
                onClick={async () => {
                  if (!inv.email) {
                    alert(`${inv.name} has no email address. Add an email first.`);
                    return;
                  }
                  setActionLoading(inv.id);
                  try {
                    const res = await fetch("/api/lp/accounts", {
                      method: "POST",
                      headers: { ...h, "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: inv.email,
                        name: inv.name,
                        investorId: inv.id,
                        sendInvite: true,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error);
                    setCreateMsg({
                      type: "ok",
                      text: data.inviteSent ? `Invited ${inv.name} (${inv.email})` : `Account created for ${inv.name} (invite email failed)`,
                    });
                    loadData();
                  } catch (err: any) {
                    setCreateMsg({ type: "err", text: err.message });
                  } finally {
                    setActionLoading(null);
                  }
                }}
                disabled={actionLoading === inv.id || !inv.email}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all hover:border-[#0D9488] hover:bg-[#F6F9FC] disabled:opacity-40"
                style={{ borderColor: "#E3E8EF", color: "#1A1F36" }}
              >
                <svg width="12" height="12" fill="none" stroke="#0D9488" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {inv.name}{inv.email ? "" : " (no email)"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
