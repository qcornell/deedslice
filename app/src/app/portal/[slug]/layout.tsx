"use client";

/**
 * LP Portal Layout — White-Label Shell
 *
 * This layout wraps all /portal/[slug] pages.
 * It fetches the tenant branding and injects CSS custom properties
 * so every child component skins itself automatically.
 *
 * No DeedSlice branding visible unless show_powered_by is true.
 * This is a configurable skin layer — not hardcoded per client.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PortalBranding {
  org_name: string;
  logo_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  text_color: string;
  bg_color: string;
  portal_title: string | null;
  footer_text: string | null;
  show_powered_by: boolean;
}

const DEFAULT_BRANDING: PortalBranding = {
  org_name: "",
  logo_url: null,
  logo_dark_url: null,
  favicon_url: null,
  primary_color: "#0D9488",
  secondary_color: "#0F172A",
  accent_color: "#6366F1",
  text_color: "#0F172A",
  bg_color: "#F8FAFC",
  portal_title: null,
  footer_text: "Powered by DeedSlice",
  show_powered_by: true,
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [branding, setBranding] = useState<PortalBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/lp/branding?slug=${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(true); return; }
        setBranding(d);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Detect system dark mode preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDarkMode(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Update document title & favicon
  useEffect(() => {
    if (branding.portal_title) {
      document.title = branding.portal_title;
    } else if (branding.org_name) {
      document.title = `${branding.org_name} — Investor Portal`;
    }
    // Dynamic favicon
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }
  }, [branding]);

  // Dark mode color derivations
  const dm = darkMode ? {
    bg: "#0F172A",
    cardBg: "rgba(30,41,59,0.85)",
    headerBg: "rgba(15,23,42,0.92)",
    text: "#F1F5F9",
    textSecondary: "#94A3B8",
    textMuted: "#64748B",
    border: "#334155",
    borderSubtle: "#1E293B",
    hoverRow: "#1E293B",
  } : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="text-center">
          <div className="text-3xl mb-4 opacity-40">🔒</div>
          <h1 className="text-lg font-bold mb-1" style={{ color: "#0F172A" }}>Portal Not Found</h1>
          <p className="text-[13px]" style={{ color: "#64748B" }}>This investor portal doesn't exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        // Inject branding as CSS custom properties — the skin layer
        ["--lp-primary" as any]: branding.primary_color,
        ["--lp-secondary" as any]: branding.secondary_color,
        ["--lp-accent" as any]: branding.accent_color,
        ["--lp-text" as any]: dm ? dm.text : branding.text_color,
        ["--lp-bg" as any]: dm ? dm.bg : branding.bg_color,
        ["--lp-card-bg" as any]: dm ? dm.cardBg : "#FFFFFF",
        ["--lp-border" as any]: dm ? dm.border : "#E2E8F0",
        ["--lp-border-subtle" as any]: dm ? dm.borderSubtle : "#F1F5F9",
        ["--lp-text-secondary" as any]: dm ? dm.textSecondary : "#64748B",
        ["--lp-text-muted" as any]: dm ? dm.textMuted : "#94A3B8",
        ["--lp-hover-row" as any]: dm ? dm.hoverRow : "#FAFBFC",
        ["--lp-dark" as any]: dm ? "1" : "0",
        background: dm ? dm.bg : branding.bg_color,
        color: dm ? dm.text : branding.text_color,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Header — operator branded */}
      <header
        className="h-14 border-b flex items-center justify-between px-4 md:px-8 shrink-0"
        style={{
          background: dm ? dm.headerBg : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: dm ? dm.border : "#E2E8F0",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Use dark logo variant if available and in dark mode */}
          {(dm && branding.logo_dark_url) ? (
            <img src={branding.logo_dark_url} alt={branding.org_name} className="h-7 w-auto" />
          ) : branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.org_name} className="h-7 w-auto" />
          ) : (
            <span
              className="text-[14px] font-bold"
              style={{ color: branding.primary_color, letterSpacing: "-0.01em" }}
            >
              {branding.org_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] transition-colors"
            style={{
              background: dm ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              color: dm ? "#94A3B8" : "#64748B",
            }}
            title={dm ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dm ? "☀️" : "🌙"}
          </button>
          <span className="text-[11px] font-medium tracking-wide" style={{ color: dm ? dm.textMuted : "#94A3B8" }}>
            Investor Portal
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* Footer — subtle powered-by only if enabled */}
      {branding.show_powered_by && branding.footer_text && (
        <footer className="py-4 text-center border-t" style={{ borderColor: dm ? dm.borderSubtle : "#F1F5F9" }}>
          <p className="text-[10px]" style={{ color: dm ? dm.textMuted : "#CBD5E1" }}>{branding.footer_text}</p>
        </footer>
      )}
    </div>
  );
}
