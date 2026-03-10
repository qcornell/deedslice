"use client";

import { Suspense } from "react";

/**
 * LP Portal — Self-Registration Page
 *
 * Clean, institutional. No DeedSlice branding.
 * Allows investors to create an account when self-registration is enabled.
 */

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function PortalRegisterPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /></div>}>
      <PortalRegisterInner />
    </Suspense>
  );
}

function PortalRegisterInner() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean | null>(null);
  const [checkingOrg, setCheckingOrg] = useState(true);

  // Check if self-registration is allowed for this org
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/lp/org-settings?slug=${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data.allow_investor_self_register) {
          setRegistrationAllowed(true);
        } else {
          setRegistrationAllowed(false);
        }
      })
      .catch(() => setRegistrationAllowed(false))
      .finally(() => setCheckingOrg(false));
  }, [slug]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !agreedToTerms) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/lp/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          orgSlug: slug,
          name,
          email,
          password: password || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // If a password was set and we got a token, auto-login
      if (data.token) {
        localStorage.setItem(`lp_token_${slug}`, data.token);
        router.push(`/portal/${slug}/dashboard`);
        return;
      }

      // Otherwise show the check-email confirmation
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Loading org settings
  if (checkingOrg) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Registration not allowed
  if (registrationAllowed === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(100,116,139,0.08)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2C7.24 2 5 4.24 5 7V9H4C3.45 9 3 9.45 3 10V17C3 17.55 3.45 18 4 18H16C16.55 18 17 17.55 17 17V10C17 9.45 16.55 9 16 9H15V7C15 4.24 12.76 2 10 2ZM10 3.9C11.71 3.9 13.1 5.29 13.1 7V9H6.9V7C6.9 5.29 8.29 3.9 10 3.9Z" fill="var(--lp-text-muted, #94A3B8)"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>
            Invite Only
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
            Registration is invite-only. Contact your investment manager for access.
          </p>
          <Link
            href={`/portal/${slug}`}
            className="inline-block mt-5 text-[12px] font-medium transition-colors"
            style={{ color: "var(--lp-primary, #0D9488)" }}
          >
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Success — check email
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <div
            className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(22,163,74,0.06)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 4C2 3.45 2.45 3 3 3H17C17.55 3 18 3.45 18 4V14C18 14.55 17.55 15 17 15H3C2.45 15 2 14.55 2 14V4ZM3 4L10 9L17 4" stroke="var(--lp-primary, #0D9488)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--lp-text, #0F172A)" }}>
            Check your email
          </h2>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
            We sent a verification link to <strong style={{ color: "var(--lp-text, #0F172A)" }}>{email}</strong>.
            Click the link to access your investor portal.
          </p>
          <p className="text-[11px] mt-4" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            Link expires in 15 minutes. Check spam if you don&apos;t see it.
          </p>
          <Link
            href={`/portal/${slug}`}
            className="inline-block mt-5 text-[12px] font-medium transition-colors"
            style={{ color: "var(--lp-primary, #0D9488)" }}
          >
            &larr; Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold" style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.01em" }}>
            Create Account
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
            Register for your investor portal
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border p-6"
          style={{ background: "var(--lp-card-bg, #FFFFFF)", borderColor: "var(--lp-border, #E2E8F0)", boxShadow: "0 1px 3px rgba(15,23,42,0.04)" }}
        >
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.04em" }}>
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Jane Smith"
                className="w-full border rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all"
                style={{ borderColor: "var(--lp-border, #E2E8F0)", color: "var(--lp-text, #0F172A)", background: "transparent" }}
              />
            </div>

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
                style={{ borderColor: "var(--lp-border, #E2E8F0)", color: "var(--lp-text, #0F172A)", background: "transparent" }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1.5 tracking-wide uppercase" style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.04em" }}>
                Password
                <span className="normal-case tracking-normal font-normal ml-1" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>(optional)</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2.5 text-[13px] outline-none transition-all"
                style={{ borderColor: "var(--lp-border, #E2E8F0)", color: "var(--lp-text, #0F172A)", background: "transparent" }}
              />
              <p className="text-[11px] mt-1" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>
                If left blank, you will sign in via email link.
              </p>
            </div>

            {/* Terms agreement */}
            <div className="flex items-start gap-2.5 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={e => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 rounded"
                style={{ accentColor: "var(--lp-primary, #0D9488)" }}
              />
              <label htmlFor="terms" className="text-[12px] leading-relaxed cursor-pointer" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
                I agree to the terms and conditions of this investment portal.
              </label>
            </div>

            {error && (
              <div className="text-[12px] rounded-lg px-3 py-2" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !agreedToTerms}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50"
              style={{
                background: "var(--lp-primary, #0D9488)",
                boxShadow: "0 1px 3px rgba(13,148,136,0.2)",
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Sign in link */}
        <p className="text-center text-[12px] mt-5" style={{ color: "var(--lp-text-secondary, #64748B)" }}>
          Already have an account?{" "}
          <Link
            href={`/portal/${slug}`}
            className="font-medium transition-colors"
            style={{ color: "var(--lp-primary, #0D9488)" }}
          >
            Sign in
          </Link>
        </p>

        {/* Security note */}
        <p className="text-center text-[10px] mt-3" style={{ color: "var(--lp-text-muted, #CBD5E1)" }}>
          Secured connection &middot; Data encrypted in transit
        </p>
      </div>
    </div>
  );
}
