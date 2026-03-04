"use client";

/**
 * Magic Link Verification Page
 * Redirects from: /portal/[slug]/auth/verify?token=xxx
 * Verifies the token and redirects to dashboard.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function VerifyPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token || !slug) { setError(true); return; }

    fetch("/api/lp/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify-magic-link", orgSlug: slug, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.token) {
          localStorage.setItem(`lp_token_${slug}`, data.token);
          router.push(`/portal/${slug}/dashboard`);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true));
  }, [token, slug, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--lp-text, #0F172A)" }}>Link expired or invalid</h2>
          <p className="text-sm mb-4" style={{ color: "#64748B" }}>Request a new login link.</p>
          <button
            onClick={() => router.push(`/portal/${slug}`)}
            className="text-sm font-medium px-4 py-2 rounded-lg text-white"
            style={{ background: "var(--lp-primary, #0D9488)" }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-6 h-6 mx-auto mb-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "#64748B" }}>Verifying your login...</p>
      </div>
    </div>
  );
}
