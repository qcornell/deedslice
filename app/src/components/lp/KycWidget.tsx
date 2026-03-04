"use client";

/**
 * KycWidget — Stripe Identity embedded verification
 *
 * Used in the LP portal for investors to complete identity verification.
 * Uses Stripe.js + Identity modal — clean, trusted UX.
 *
 * Flow: click button → create session → open Stripe modal → done
 *
 * Super user-friendly:
 *   - One-click start
 *   - Clear status indicators
 *   - Friendly language (no jargon)
 *   - Progress feedback
 *   - Stripe's trusted brand
 */

import { useState, useEffect, useCallback } from "react";

interface Props {
  slug: string;
  kycStatus: string;
  onComplete?: () => void;
}

type WidgetState = "idle" | "loading" | "error" | "submitted";

// Load Stripe.js
function loadStripeJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).Stripe) {
      resolve((window as any).Stripe);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.onload = () => resolve((window as any).Stripe);
    script.onerror = () => reject(new Error("Failed to load payment system"));
    document.head.appendChild(script);
  });
}

export default function KycWidget({ slug, kycStatus, onComplete }: Props) {
  const [state, setState] = useState<WidgetState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // ── Already verified ──
  if (kycStatus === "verified") {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "#D1FAE5", background: "#F0FDF4" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#D1FAE5" }}>
            <span className="text-lg">✓</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#166534" }}>Identity Verified</h3>
            <p className="text-[12px]" style={{ color: "#16A34A" }}>
              Your identity has been confirmed. No further action needed.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Rejected ──
  if (kycStatus === "rejected") {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "#FECACA", background: "#FEF2F2" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FECACA" }}>
            <span className="text-lg">✕</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#991B1B" }}>Verification Unsuccessful</h3>
            <p className="text-[12px]" style={{ color: "#DC2626" }}>
              We couldn't verify your identity. Please contact your investment manager for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Submitted (just completed this session) ──
  if (state === "submitted") {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "#D1FAE5", background: "#F0FDF4" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#D1FAE5" }}>
            <span className="text-lg">✓</span>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold" style={{ color: "#166534" }}>Documents Submitted</h3>
            <p className="text-[12px]" style={{ color: "#16A34A" }}>
              Thank you! We're reviewing your documents now. This usually takes just a few minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function startVerification() {
    setState("loading");
    setErrorMsg("");

    try {
      const lpToken = localStorage.getItem(`lp_token_${slug}`);
      if (!lpToken) throw new Error("Please log in again");

      // 1. Create Stripe Identity session from our backend
      const res = await fetch("/api/kyc/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lpToken}`,
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.status === "verified") {
          setState("submitted");
          onComplete?.();
          return;
        }
        throw new Error(data.error || "Failed to start verification");
      }

      // 2. Load Stripe.js
      const StripeFactory = await loadStripeJs();
      const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      if (!stripePublicKey) throw new Error("Verification system not configured");

      const stripeClient = StripeFactory(stripePublicKey);

      // 3. Open Stripe Identity modal
      const { error } = await stripeClient.verifyIdentity(data.clientSecret);

      if (error) {
        // User closed the modal or there was an error
        if (error.code === "session_cancelled") {
          // User just closed it — go back to idle
          setState("idle");
          return;
        }
        throw new Error(error.message || "Verification was not completed");
      }

      // 4. Success — user completed the flow
      setState("submitted");
      onComplete?.();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setState("error");
    }
  }

  // ── Pending (previously started) ──
  if (kycStatus === "pending" && state === "idle") {
    return (
      <div className="rounded-xl border p-5" style={{ borderColor: "#FDE68A", background: "#FFFBEB" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#FDE68A" }}>
            <span className="text-lg">⏳</span>
          </div>
          <div className="flex-1">
            <h3 className="text-[14px] font-semibold" style={{ color: "#92400E" }}>Verification In Progress</h3>
            <p className="text-[12px] mt-0.5" style={{ color: "#D97706" }}>
              We're reviewing your documents. This usually takes a few minutes.
            </p>
            <button
              onClick={startVerification}
              className="mt-3 text-[12px] font-medium px-4 py-2 rounded-lg border transition-colors"
              style={{ color: "#D97706", borderColor: "#FDE68A" }}
            >
              Resume or update documents →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Default: not started / error ──
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "#E2E8F0", background: "#FFFFFF" }}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "#F1F5F9" }}>
          <span className="text-lg">🪪</span>
        </div>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold" style={{ color: "#0F172A" }}>
            Identity Verification Required
          </h3>
          <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#64748B" }}>
            To protect all investors, we need to verify your identity. This takes about 2 minutes —
            you'll need a government-issued ID and your camera.
          </p>

          {errorMsg && (
            <div className="mt-3 text-[12px] rounded-lg px-3 py-2" style={{ background: "#FEF2F2", color: "#DC2626" }}>
              {errorMsg}
            </div>
          )}

          <button
            onClick={startVerification}
            disabled={state === "loading"}
            className="mt-3 text-[13px] font-semibold px-5 py-2.5 rounded-lg text-white transition-all disabled:opacity-50"
            style={{ background: "var(--lp-primary, #0D9488)", boxShadow: "0 1px 3px rgba(13,148,136,0.2)" }}
          >
            {state === "loading" ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Starting...
              </span>
            ) : state === "error" ? (
              "Try Again"
            ) : (
              "Verify My Identity →"
            )}
          </button>

          <p className="mt-3 text-[10px]" style={{ color: "#CBD5E1" }}>
            🔒 Secured by Stripe · Your data is encrypted and we never store your ID documents.
          </p>
        </div>
      </div>
    </div>
  );
}
