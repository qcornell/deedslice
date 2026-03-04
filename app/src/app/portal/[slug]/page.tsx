"use client";

/**
 * LP Portal — Login Page
 *
 * Clean, institutional. No DeedSlice branding.
 * Supports magic link and password auth.
 */

import { useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function PortalLoginPage() {
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
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
            <span className="text-xl">✉️</span>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>Check your email</h2>
          <p className="text-sm" style={{ color: "#64748B" }}>
            We sent a login link to <strong>{email}</strong>. Click the link to access your investor portal.
          </p>
          <p className="text-xs mt-4" style={{ color: "#94A3B8" }}>
            Link expires in 15 minutes. Check spam if you don't see it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold" style={{ color: "var(--lp-text, #0F172A)" }}>Investor Login</h1>
          <p className="text-sm mt-1" style={{ color: "#64748B" }}>Access your investment portfolio</p>
        </div>

        <div className="bg-white rounded-xl border p-6" style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {/* Mode toggle */}
          <div className="flex rounded-lg border mb-5" style={{ borderColor: "#E5E7EB" }}>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className="flex-1 py-2 text-xs font-medium transition rounded-l-lg"
              style={{
                background: mode === "magic" ? "var(--lp-primary, #0D9488)" : "transparent",
                color: mode === "magic" ? "#fff" : "#64748B",
              }}
            >
              Email Link
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className="flex-1 py-2 text-xs font-medium transition rounded-r-lg"
              style={{
                background: mode === "password" ? "var(--lp-primary, #0D9488)" : "transparent",
                color: mode === "password" ? "#fff" : "#64748B",
              }}
            >
              Password
            </button>
          </div>

          <form onSubmit={mode === "magic" ? handleMagicLink : handlePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#64748B" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="investor@example.com"
                className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition"
                style={{ borderColor: "#E5E7EB", color: "var(--lp-text, #0F172A)" }}
                onFocus={e => e.target.style.borderColor = "var(--lp-primary, #0D9488)"}
                onBlur={e => e.target.style.borderColor = "#E5E7EB"}
              />
            </div>

            {mode === "password" && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#64748B" }}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition"
                  style={{ borderColor: "#E5E7EB", color: "var(--lp-text, #0F172A)" }}
                  onFocus={e => e.target.style.borderColor = "var(--lp-primary, #0D9488)"}
                  onBlur={e => e.target.style.borderColor = "#E5E7EB"}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: "var(--lp-primary, #0D9488)" }}
            >
              {loading ? "..." : mode === "magic" ? "Send Login Link" : "Sign In"}
            </button>
          </form>
        </div>
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

  useState(() => {
    fetch("/api/lp/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-magic-link", orgSlug: slug, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.token) {
          localStorage.setItem(`lp_token_${slug}`, data.token);
          setStatus("success");
          router.push(`/portal/${slug}/dashboard`);
        } else {
          setStatus("error");
        }
      })
      .catch(() => setStatus("error"));
  });

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        {status === "verifying" && (
          <>
            <div className="w-6 h-6 mx-auto mb-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-sm" style={{ color: "#64748B" }}>Verifying your login...</p>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-3xl mb-3">⚠️</div>
            <h2 className="text-lg font-semibold mb-1">Link expired or invalid</h2>
            <p className="text-sm" style={{ color: "#64748B" }}>Request a new login link.</p>
            <button
              onClick={() => router.push(`/portal/${slug}`)}
              className="mt-4 text-sm font-medium px-4 py-2 rounded-lg text-white"
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
