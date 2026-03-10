"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Property, Investor, Profile, Organization } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════
 *  OnboardingChecklist — First-time operator setup guide
 *
 *  Shows a dismissible getting-started checklist at the top
 *  of the dashboard. Auto-hides once 4+ steps are complete.
 *  Stores dismissal in localStorage.
 * ═══════════════════════════════════════════════════════════════ */

interface OnboardingChecklistProps {
  properties: Property[];
  investors: Investor[];
  profile: Profile | null;
  org: Organization | null;
}

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  done: boolean;
  href: string;
  ctaLabel: string;
  recommended?: boolean;
}

const STORAGE_KEY = "onboarding_dismissed";

export default function OnboardingChecklist({
  properties,
  investors,
  profile,
  org,
}: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState<boolean | null>(null); // null = loading

  // Hydrate from localStorage (client-only)
  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  const steps: Step[] = useMemo(() => {
    const hasProperties = properties.length > 0;
    const hasLive = properties.some((p) => p.status === "live");
    const hasInvestors = investors.length > 0;
    const hasOrg = org !== null;
    const hasUpgraded = profile !== null && profile.plan !== "starter";

    return [
      {
        id: "account",
        icon: <IconUser />,
        title: "Create your account",
        subtitle: "You're signed in — nice work!",
        done: true, // always done if they're here
        href: "#",
        ctaLabel: "Done",
      },
      {
        id: "property",
        icon: <IconBuilding />,
        title: "Add your first property",
        subtitle: "Tokenize a property to create NFT deeds on Hedera",
        done: hasProperties,
        href: "/dashboard/new",
        ctaLabel: "Add Property",
      },
      {
        id: "deploy",
        icon: <IconRocket />,
        title: "Deploy to blockchain",
        subtitle: "Mint your property's NFT and share token on-chain",
        done: hasLive,
        href: hasProperties
          ? `/dashboard/property/${properties[0]?.id}`
          : "/dashboard/new",
        ctaLabel: "Deploy",
      },
      {
        id: "investor",
        icon: <IconUsers />,
        title: "Add an investor",
        subtitle: "Assign slices to your first investor",
        done: hasInvestors,
        href: "/dashboard/investors",
        ctaLabel: "Add Investor",
      },
      {
        id: "portal",
        icon: <IconGlobe />,
        title: "Set up your portal",
        subtitle: "Create a white-label investor portal with your brand",
        done: hasOrg,
        href: "/dashboard/settings",
        ctaLabel: "Set Up Portal",
      },
      {
        id: "plan",
        icon: <IconStar />,
        title: "Choose a plan",
        subtitle: "Unlock more properties, custom domains & API access",
        done: hasUpgraded,
        href: "/dashboard/settings",
        ctaLabel: "Upgrade",
        recommended: true,
      },
    ];
  }, [properties, investors, profile, org]);

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  const progressPct = (completedCount / totalSteps) * 100;

  // Find first incomplete step to highlight as "current"
  const currentStepId = steps.find((s) => !s.done)?.id ?? null;

  // Don't render while loading localStorage
  if (dismissed === null) return null;

  // Auto-hide when 4+ steps complete
  if (completedCount >= 4) {
    return null;
  }

  // Dismissed — show small resume link
  if (dismissed) {
    return (
      <div className="mb-6 animate-fade-in">
        <button
          onClick={() => {
            localStorage.removeItem(STORAGE_KEY);
            setDismissed(false);
          }}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:opacity-80"
          style={{ color: "#0ab4aa" }}
        >
          <svg
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Resume setup guide
        </button>
      </div>
    );
  }

  return (
    <div className="mb-8 animate-fade-in">
      <div
        className="glass rounded-2xl p-6"
        style={{ border: "1px solid #E2E8F0" }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2
              className="text-[18px] font-semibold mb-1"
              style={{ color: "#1A1F36" }}
            >
              Getting started
            </h2>
            <p className="text-[13px]" style={{ color: "#697386" }}>
              Complete these steps to set up your tokenization platform
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <svg
                  className="w-10 h-10 -rotate-90"
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#0ab4aa"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 97.4} 97.4`}
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold"
                  style={{ color: "#1A1F36" }}
                >
                  {completedCount}/{totalSteps}
                </span>
              </div>
              <span
                className="text-[13px] font-medium hidden sm:inline"
                style={{ color: "#697386" }}
              >
                {completedCount} of {totalSteps} complete
              </span>
            </div>
            {/* Dismiss button */}
            <button
              onClick={() => {
                localStorage.setItem(STORAGE_KEY, "true");
                setDismissed(true);
              }}
              className="p-1 rounded-md transition-colors hover:bg-[#F1F5F9]"
              title="Dismiss setup guide"
            >
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#94A3B8"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div
          className="h-1.5 rounded-full mb-6 overflow-hidden"
          style={{ background: "#E2E8F0" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: "#0ab4aa",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* ── Steps ── */}
        <div className="space-y-2">
          {steps.map((step) => {
            const isCurrent = step.id === currentStepId;
            const isDone = step.done;

            return (
              <div
                key={step.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all"
                style={{
                  background: isCurrent
                    ? "rgba(10,180,170,0.04)"
                    : "transparent",
                  border: isCurrent
                    ? "1px solid rgba(10,180,170,0.15)"
                    : "1px solid transparent",
                }}
              >
                {/* Status icon */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: isDone
                      ? "#0ab4aa"
                      : isCurrent
                        ? "rgba(10,180,170,0.1)"
                        : "#F1F5F9",
                  }}
                >
                  {isDone ? (
                    <svg
                      width="14"
                      height="14"
                      fill="none"
                      stroke="#FFFFFF"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span
                      style={{
                        color: isCurrent ? "#0ab4aa" : "#94A3B8",
                      }}
                    >
                      {step.icon}
                    </span>
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px] font-medium"
                      style={{
                        color: isDone ? "#94A3B8" : "#1A1F36",
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {step.title}
                    </span>
                    {step.recommended && !isDone && (
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{
                          background: "rgba(10,180,170,0.08)",
                          color: "#0ab4aa",
                        }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>
                  <p
                    className="text-[12px] mt-0.5"
                    style={{ color: isDone ? "#CBD5E1" : "#697386" }}
                  >
                    {step.subtitle}
                  </p>
                </div>

                {/* CTA button */}
                {!isDone && (
                  <Link
                    href={step.href}
                    className="flex-shrink-0 inline-flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-lg transition-all"
                    style={
                      isCurrent
                        ? {
                            background: "#0ab4aa",
                            color: "#FFFFFF",
                            boxShadow:
                              "0 1px 3px rgba(10,180,170,0.2)",
                          }
                        : {
                            background: "transparent",
                            color: "#0ab4aa",
                            border: "1px solid #E2E8F0",
                          }
                    }
                  >
                    {step.ctaLabel}
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                )}

                {/* Done indicator */}
                {isDone && step.id !== "account" && (
                  <span
                    className="flex-shrink-0 text-[12px] font-medium"
                    style={{ color: "#0ab4aa" }}
                  >
                    Complete
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 *  Step Icons — small inline SVGs
 * ═══════════════════════════════════════════════════════════════ */

function IconUser() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function IconRocket() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 003.46-8.62 2.25 2.25 0 00-2.18-2.18 14.98 14.98 0 00-8.62 3.46m5.34 7.34L7.77 21.38A2.16 2.16 0 015 19.62V17m9.59-2.63L5.21 5.03A2.25 2.25 0 003 7.21v2.56" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}
