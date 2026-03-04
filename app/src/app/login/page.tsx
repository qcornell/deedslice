"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await (supabase as any).auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, fullName, companyName }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (data.session) {
          await (supabase as any).auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
    }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.png" alt="DeedSlice" className="h-10 w-auto" />
          </div>
          <p className="text-ds-muted text-sm">Tokenization infrastructure for real estate syndicators</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 space-y-5 border border-ds-border shadow-lg" style={{
          boxShadow: "0 12px 36px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)",
        }}>
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border border-ds-border">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 text-sm font-medium transition ${mode === "login" ? "bg-ds-accent-light text-ds-accent" : "text-ds-muted hover:text-ds-text"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 text-sm font-medium transition ${mode === "signup" ? "bg-ds-accent-light text-ds-accent" : "text-ds-muted hover:text-ds-text"}`}
            >
              Create Account
            </button>
          </div>

          {mode === "signup" && (
            <>
              <div>
                <label className="block text-xs text-ds-muted mb-1.5 font-medium">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-ds-border rounded-lg px-4 py-2.5 text-sm text-ds-text focus:outline-none focus:border-ds-accent focus:ring-2 focus:ring-ds-accent-dim transition"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-ds-muted mb-1.5 font-medium">Company (optional)</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-white border border-ds-border rounded-lg px-4 py-2.5 text-sm text-ds-text focus:outline-none focus:border-ds-accent focus:ring-2 focus:ring-ds-accent-dim transition"
                  placeholder="Smith Capital LLC"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-ds-muted mb-1.5 font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white border border-ds-border rounded-lg px-4 py-2.5 text-sm text-ds-text focus:outline-none focus:border-ds-accent focus:ring-2 focus:ring-ds-accent-dim transition"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs text-ds-muted mb-1.5 font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-white border border-ds-border rounded-lg px-4 py-2.5 text-sm text-ds-text focus:outline-none focus:border-ds-accent focus:ring-2 focus:ring-ds-accent-dim transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-ds-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ds-accent text-white font-semibold py-3 rounded-lg hover:bg-ds-accent-hover transition disabled:opacity-50"
            style={{
              boxShadow: "0 1px 2px rgba(13,148,136,0.2), 0 0 0 1px rgba(13,148,136,0.1)",
            }}
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>

          {mode === "signup" && (
            <>
              <p className="text-center text-xs text-ds-muted">
                Free Starter plan — 1 property, no credit card required.
              </p>
              <p className="text-center text-[10px] text-ds-muted/60">
                By creating an account, you agree to our{" "}
                <a href="/terms" className="text-ds-accent hover:underline">Terms of Service</a>{" "}
                and <a href="/privacy" className="text-ds-accent hover:underline">Privacy Policy</a>.
              </p>
            </>
          )}
        </form>

        <p className="text-center text-xs text-ds-muted mt-6">
          Powered by <a href="https://dappily.io" className="text-ds-accent hover:underline">Dappily</a> & <a href="https://hedera.com" className="text-ds-accent hover:underline">Hedera</a>
        </p>
      </div>
    </div>
  );
}
