"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { HEDERA_NETWORK } from "@/lib/hedera/config";

/* ── SVG icon components (Heroicons outline, 20×20) ─────────── */
const icons: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  properties: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  tokenize: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  investors: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  distributions: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  audit: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", iconKey: "dashboard" },
  { href: "/dashboard/properties", label: "Properties", iconKey: "properties" },
  { href: "/dashboard/new", label: "Tokenize", iconKey: "tokenize" },
  { href: "/dashboard/investors", label: "Investors", iconKey: "investors" },
  { href: "/dashboard/distributions", label: "Distributions", iconKey: "distributions" },
  { href: "/dashboard/audit", label: "Audit Trail", iconKey: "audit" },
  { href: "/dashboard/settings", label: "Settings", iconKey: "settings" },
];

interface Props {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const pathname = usePathname();
  const isMainnet = HEDERA_NETWORK === "mainnet";

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen flex flex-col z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          width: "240px",
          background: "#1a2332",
        }}
      >
        {/* Logo + mobile close */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/[0.06]">
          <a href="https://deedslice.com" className="flex items-center">
            <img src="/logo2.png" alt="DeedSlice" className="h-6 w-auto" />
          </a>
          <button
            onClick={onClose}
            className="lg:hidden text-white/40 hover:text-white text-xl p-1"
          >
            ×
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 mt-2">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all text-[15px]
                  ${active
                    ? "bg-[#2d3b4e] text-white"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.05]"
                  }`}
                style={{ fontWeight: active ? 500 : 400 }}
              >
                <span className="w-5 h-5 flex-shrink-0 opacity-80">{icons[item.iconKey]}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Network indicator */}
        <div className="p-3 border-t border-white/[0.06]">
          <div
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] text-white/50"
            style={{ background: "rgba(255,255,255,0.03)", fontWeight: 400 }}
          >
            <div className={`w-2 h-2 rounded-full ${isMainnet ? "bg-[#0ACF83]" : "bg-yellow-400"}`} />
            <span>{isMainnet ? "Hedera Mainnet" : "Hedera Testnet"}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
