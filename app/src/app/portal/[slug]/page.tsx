"use client";

import { Suspense } from "react";

/**
 * LP Portal — Login Page
 *
 * Clean, institutional. No DeedSlice branding.
 * Supports magic link and password auth.
 */

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function PortalLoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>}>
      <PortalLoginInner />
    </Suspense>
  );
}

function PortalLoginInner() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Handle magic link verification from URL
  const verifyToken = searchParams.get("token");
  if (verifyToken) {
    return <VerifyMagicLink slug={slug} token={verifyToken} />;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lp/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "magic-link", orgSlug: slug, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lp/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", orgSlug: slug, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      localStorage.setItem(`lp_token_${slug}`, data.token);
      router.push(`/portal/${slug}/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(22,163,74,0.06)" }}
          >
            <span className="text-xl">✉️</span>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>Check your email</h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
            We sent a login link to <strong style={{ color: "var(--lp-text, #0F172A)" }}>{email}</strong>. Click the link to access your investor portal.
          </p>
          <p className="text-[11px] mt-4" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            Link expires in 15 minutes. Check spam if you don't see it.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-5 text-[12px] font-medium transition-colors"
            style={{ color: "var(--lp-primary, #0D9488)" }}
          >
            ← Try a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.01em" }}>
            Investor Login
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            Access your investment portfolio
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--lp-card-bg, #FFFFFF)", borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
        >
          {/* Mode toggle */}
          <div className="flex rounded-lg border mb-5" style={{ borderColor: "var(--lp-border, #E2E8F0)" }}>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className="flex-1 py-2 text-[12px] font-medium transition-all rounded-l-lg"
              style={{
                background: mode === "magic" ? "var(--lp-primary, #0D9488)" : "transparent",
                color: mode === "magic" ? "#fff" : "#94A3B8",
              }}
            >
              Email Link
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className="flex-1 py-2 text-[12px] font-medium transition-all rounded-r-lg"
              style={{
                background: mode === "password" ? "var(--lp-primary, #0D9488)" : "transparent",
                color: mode === "password" ? "#fff" : "#94A3B8",
              }}
            >
              Password
            </button>
          </div>

          <form onSubmit={mode === "magic" ? handleMagicLink : handlePassword} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.04em" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="investor@example.com"
                className="w-full border rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all"
                style={{ borderColor: "var(--lp-border, #E2E8F0)", color: "var(--lp-text, #0F172A)" }}
              />
            </div>

            {mode === "password" && (
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.04em" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all"
                  style={{ borderColor: "var(--lp-border, #E2E8F0)", color: "var(--lp-text, #0F172A)" }}
                />
              </div>
            )}

            {error && (
              <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: "var(--lp-primary, #0D9488)",
                boxShadow: "0 1px 3px rgba(13,148,136,0.2)",
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === "magic" ? "Sending..." : "Signing in..."}
                </span>
              ) : (
                mode === "magic" ? "Send Login Link" : "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Security note */}
        <p className="text-center text-[10px] mt-5" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>
          Secured connection · Data encrypted in transit
        </p>
      </div>
    </div>
  );
}

/**
 * Magic link verification sub-component
 */
function VerifyMagicLink({ slug, token }: { slug: string; token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lp/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-magic-link", orgSlug: slug, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.ok && data.token) {
          localStorage.setItem(`lp_token_${slug}`, data.token);
          setStatus("success");
          router.push(`/portal/${slug}/dashboard`);
        } else {
          setStatus("error");
        }
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, [slug, token, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {status === "verifying" && (
          <>
            <div className="w-5 h-5 mx-auto mb-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-[13px]" style={{ color: "var(--lp-text-secondary, #64748B)" }}>Verifying your login...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-bold mb-1" style={{ color: "var(--lp-text, #0F172A)" }}>Link expired or invalid</h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--lp-text-secondary, #64748B)" }}>Request a new login link.</p>
            <button
              onClick={() => router.push(`/portal/${slug}`)}
              className="text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white"
              style={{ background: "var(--lp-primary, #0D9488)" }}
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
