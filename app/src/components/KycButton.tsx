"use client";

/**
 * KycButton — Operator-side KYC controls
 *
 * Used in investor management for operators to:
 *   1. Initiate Stripe Identity verification for an investor
 *   2. Check live verification status
 *   3. Manually override KYC status
 *
 * Clean, inline UI — no modal, no page navigation.
 */

import { useState } from "react";

interface Props {
  investorId: string;
  investorName: string;
  investorEmail: string | null;
  kycStatus: string;
  session: any;
  onStatusChange?: (newStatus: string) => void;
}

export default function KycButton({
  investorId,
  investorName,
  investorEmail,
  kycStatus,
  session,
  onStatusChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [error, setError] = useState("");
  const [initiated, setInitiated] = useState(false);

  async function initiateKyc() {
    if (!investorEmail) {
      setError("Add investor email first");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kyc/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ investorId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setInitiated(true);
      onStatusChange?.("pending");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkLiveStatus() {
    setChecking(true);
    setError("");
    try {
      const res = await fetch(`/api/kyc/status?investorId=${investorId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLiveStatus(data);

      // Auto-sync if DB is out of date
      if (data.stripe?.status === "verified" && data.dbStatus !== "verified") {
        onStatusChange?.("verified");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  async function manualOverride(newStatus: "verified" | "rejected" | "unverified") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/investors/kyc", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          investorId,
          status: newStatus,
          notes: "Manual override by operator",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onStatusChange?.(newStatus);
      setLiveStatus(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    verified: { bg: "#F0FDF4", text: "#16A34A", label: "✓ Verified" },
    pending: { bg: "#FFFBEB", text: "#D97706", label: "⏳ Pending" },
    rejected: { bg: "#FEF2F2", text: "#DC2626", label: "✕ Rejected" },
    unverified: { bg: "#F1F5F9", text: "#94A3B8", label: "Not Started" },
  };

  const config = statusConfig[kycStatus] || statusConfig.unverified;

  return (
    <div className="space-y-2">
      {/* Status + actions row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
          style={{ background: config.bg, color: config.text }}
        >
          {config.label}
        </span>

        {/* Start KYC */}
        {kycStatus === "unverified" && (
          <button
            onClick={initiateKyc}
            disabled={loading || !investorEmail}
            className="text-[10px] font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
            style={{ color: "#0D9488", background: "rgba(13,148,136,0.06)" }}
            title={!investorEmail ? "Add email first" : `Start KYC for ${investorName}`}
          >
            {loading ? "..." : initiated ? "✓ Started" : "Start KYC"}
          </button>
        )}

        {/* Check status */}
        {kycStatus !== "unverified" && (
          <button
            onClick={checkLiveStatus}
            disabled={checking}
            className="text-[10px] font-medium px-2 py-1 rounded transition-colors disabled:opacity-50"
            style={{ color: "#64748B", background: "#F1F5F9" }}
          >
            {checking ? "..." : "Check"}
          </button>
        )}
      </div>

      {/* Live status panel */}
      {liveStatus && (
        <div className="bg-gray-50 rounded-lg p-3 text-[11px] space-y-1.5">
          <div className="flex justify-between">
            <span style={{ color: "#64748B" }}>DB Status</span>
            <span className="font-medium">{liveStatus.dbStatus}</span>
          </div>
          {liveStatus.stripe && (
            <div className="flex justify-between">
              <span style={{ color: "#64748B" }}>Stripe</span>
              <span
                className="font-medium"
                style={{ color: liveStatus.stripe.status === "verified" ? "#16A34A" : "#D97706" }}
              >
                {liveStatus.stripe.status}
              </span>
            </div>
          )}
          {liveStatus.dbNotes && (
            <div className="text-[10px]" style={{ color: "#94A3B8" }}>
              {liveStatus.dbNotes}
            </div>
          )}
          {!liveStatus.stripe && (
            <div className="text-[10px]" style={{ color: "#94A3B8" }}>
              No Stripe session found — investor hasn't started verification yet
            </div>
          )}

          {/* Manual overrides */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t" style={{ borderColor: "#E2E8F0" }}>
            <span className="text-[10px]" style={{ color: "#94A3B8" }}>Manual:</span>
            {kycStatus !== "verified" && (
              <button
                onClick={() => manualOverride("verified")}
                disabled={loading}
                className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
                style={{ color: "#16A34A", background: "#F0FDF4" }}
              >
                Approve
              </button>
            )}
            {kycStatus !== "rejected" && (
              <button
                onClick={() => manualOverride("rejected")}
                disabled={loading}
                className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
                style={{ color: "#DC2626", background: "#FEF2F2" }}
              >
                Reject
              </button>
            )}
            {kycStatus !== "unverified" && (
              <button
                onClick={() => manualOverride("unverified")}
                disabled={loading}
                className="text-[10px] px-1.5 py-0.5 rounded disabled:opacity-50"
                style={{ color: "#64748B", background: "#F1F5F9" }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-[10px] rounded px-2 py-1" style={{ background: "#FEF2F2", color: "#DC2626" }}>
          {error}
        </div>
      )}
    </div>
  );
}
