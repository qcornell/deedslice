"use client";

import { useState } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";

type NotifyType = "distribution" | "document" | "update";

interface Props {
  session: any;
  propertyId: string;
  propertyName: string;
  investorCount: number;
  investorsWithEmailCount: number;
  distributionPeriods: string[];
  onClose: () => void;
}

export default function NotifyInvestorsModal({
  session,
  propertyId,
  propertyName,
  investorCount,
  investorsWithEmailCount,
  distributionPeriods,
  onClose,
}: Props) {
  const [type, setType] = useState<NotifyType>("distribution");
  const [period, setPeriod] = useState(distributionPeriods[0] || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors?: string[] } | null>(null);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!session) return;
    setSending(true);
    setError("");
    setResult(null);

    try {
      const body: Record<string, string> = { propertyId, type };
      if (type === "distribution" && period) body.period = period;
      if (type === "update") {
        body.subject = subject;
        body.message = message;
      }

      const res = await fetch("/api/investors/notify", {
        method: "POST",
        headers: getAuthHeaders(session),
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send notifications");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const canSend =
    investorsWithEmailCount > 0 &&
    (type === "distribution" ? !!period : true) &&
    (type === "update" ? subject.trim() && message.trim() : true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: "rgba(10,180,170,0.12)" }}>
              🔔
            </div>
            <div>
              <h2 className="font-semibold text-base">Notify Investors</h2>
              <p className="text-xs text-ds-muted">{propertyName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ds-muted hover:text-ds-text text-lg transition p-1"
          >
            ✕
          </button>
        </div>

        {/* Success state */}
        {result && (
          <div className="space-y-4">
            <div className="rounded-xl p-5 text-center" style={{ background: "rgba(16,185,148,0.08)", border: "1px solid rgba(16,185,148,0.2)" }}>
              <div className="text-3xl mb-2">✉️</div>
              <div className="font-semibold text-lg" style={{ color: "#10B981" }}>
                {result.sent} email{result.sent !== 1 ? "s" : ""} sent
              </div>
              {result.failed > 0 && (
                <div className="text-sm text-ds-red mt-1">
                  {result.failed} failed
                </div>
              )}
            </div>
            {result.errors && result.errors.length > 0 && (
              <div className="rounded-lg p-3 text-xs space-y-1 bg-ds-red/5 border border-ds-red/20">
                <div className="font-medium text-ds-red mb-1">Errors:</div>
                {result.errors.map((e, i) => (
                  <div key={i} className="text-ds-muted">{e}</div>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="w-full text-white font-semibold px-6 py-2.5 rounded-[10px] text-[13px] transition-all hover:translate-y-[-1px]"
              style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
            >
              Done
            </button>
          </div>
        )}

        {/* Form state */}
        {!result && (
          <div className="space-y-5">
            {/* Notification type */}
            <div>
              <label className="block text-xs text-ds-muted mb-2 uppercase tracking-wider">Notification Type</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "distribution" as const, label: "Distribution", icon: "💰" },
                  { value: "document" as const, label: "Documents", icon: "📄" },
                  { value: "update" as const, label: "Custom", icon: "✉️" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                      type === opt.value
                        ? "border-ds-accent/50 bg-ds-accent/5 text-ds-accent-text"
                        : "border-ds-border bg-ds-bg text-ds-muted hover:border-ds-accent/30"
                    }`}
                  >
                    <span className="text-lg">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            {type === "distribution" && (
              <div>
                <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Distribution Period</label>
                {distributionPeriods.length > 0 ? (
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                  >
                    {distributionPeriods.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-ds-bg border border-ds-border rounded-lg px-4 py-3 text-xs text-ds-muted">
                    No distribution periods found. Record distributions first.
                  </div>
                )}
                <p className="text-[11px] text-ds-muted mt-1.5">
                  Each investor will receive their individual distribution amount for this period.
                </p>
              </div>
            )}

            {type === "document" && (
              <div className="bg-ds-bg border border-ds-border rounded-xl px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <div className="text-sm font-medium mb-1">Document notification</div>
                    <p className="text-xs text-ds-muted leading-relaxed">
                      Investors will receive an email saying new documents have been uploaded
                      to <strong>{propertyName}</strong>, with a link to their investor portal.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {type === "update" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Q1 2026 Property Update"
                    className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-ds-muted mb-1 uppercase tracking-wider">Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder="Write your message to investors..."
                    className="w-full bg-ds-bg border border-ds-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-ds-accent transition resize-none"
                  />
                  <p className="text-[10px] text-ds-muted mt-1">
                    Line breaks will be preserved. Each investor&apos;s name will be used in the greeting.
                  </p>
                </div>
              </div>
            )}

            {/* Email count preview */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ds-muted">📧</span>
              <span className="text-ds-muted">
                This will email <strong className="text-ds-text">{investorsWithEmailCount}</strong> investor{investorsWithEmailCount !== 1 ? "s" : ""}
                {investorsWithEmailCount < investorCount && (
                  <span className="text-ds-muted">
                    {" "}({investorCount - investorsWithEmailCount} without email will be skipped)
                  </span>
                )}
              </span>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg px-4 py-2 text-sm bg-ds-red/10 border border-ds-red/30 text-ds-red">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSend}
                disabled={sending || !canSend}
                className="flex-1 text-white font-semibold px-6 py-2.5 rounded-[10px] text-[13px] transition-all disabled:opacity-50 hover:translate-y-[-1px]"
                style={{ background: "#0ab4aa", boxShadow: "0 2px 8px rgba(13,148,136,0.25)" }}
              >
                {sending ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : (
                  `Send to ${investorsWithEmailCount} Investor${investorsWithEmailCount !== 1 ? "s" : ""}`
                )}
              </button>
              <button
                onClick={onClose}
                disabled={sending}
                className="px-4 py-2.5 rounded-[10px] text-[13px] font-medium text-ds-muted hover:text-ds-text border border-ds-border hover:border-ds-accent/30 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
