"use client";

/**
 * LP Portal Layout — White-Label Shell
 *
 * This layout wraps all /portal/[slug] pages.
 * It fetches the tenant branding and injects CSS custom properties
 * so every child component skins itself automatically.
 *
 * No DeedSlice branding visible unless show_powered_by is true.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface PortalBranding {
  org_name: string;
  logo_url: string | null;
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

  // Update document title
  useEffect(() => {
    if (branding.portal_title) {
      document.title = branding.portal_title;
    } else if (branding.org_name) {
      document.title = `${branding.org_name} — Investor Portal`;
    }
  }, [branding]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Portal Not Found</h1>
          <p className="text-sm text-gray-500">This investor portal doesn't exist or is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        // Inject branding as CSS custom properties
        ["--lp-primary" as any]: branding.primary_color,
        ["--lp-secondary" as any]: branding.secondary_color,
        ["--lp-accent" as any]: branding.accent_color,
        ["--lp-text" as any]: branding.text_color,
        ["--lp-bg" as any]: branding.bg_color,
        background: branding.bg_color,
        color: branding.text_color,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Header */}
      <header
        className="h-14 border-b flex items-center justify-between px-4 md:px-8 shrink-0"
        style={{
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderColor: "#E5E7EB",
        }}
      >
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.org_name} className="h-7 w-auto" />
          ) : (
            <span className="text-sm font-semibold" style={{ color: branding.primary_color }}>
              {branding.org_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Investor Portal</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>

      {/* Footer */}
      {branding.show_powered_by && branding.footer_text && (
        <footer className="py-4 text-center border-t" style={{ borderColor: "#E5E7EB" }}>
          <p className="text-[10px] text-gray-400">{branding.footer_text}</p>
        </footer>
      )}
    </div>
  );
}
