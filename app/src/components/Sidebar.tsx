"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { HEDERA_NETWORK } from "@/lib/hedera/config";

const navItems = [
  { href: "/dashboard", label: "Properties", icon: "🏠" },
  { href: "/dashboard/new", label: "Tokenize", icon: "⚡" },
  { href: "/dashboard/investors", label: "Investors", icon: "👥" },
  { href: "/dashboard/distributions", label: "Distributions", icon: "💰" },
  { href: "/dashboard/audit", label: "Audit Trail", icon: "📋" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
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
          fixed left-0 top-0 h-screen w-64 bg-ds-navy flex flex-col z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "linear-gradient(180deg, #0F172A 0%, #162032 100%)",
        }}
      >
        {/* Logo + mobile close */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06]">
          <a href="https://deedslice.com" className="flex items-center">
            <img src="/logo2.png" alt="DeedSlice" className="h-7 w-auto" />
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
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] transition-all text-[13px] font-medium
                  ${active
                    ? "bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                style={active ? { borderLeft: "2px solid #0D9488", paddingLeft: "12px" } : {}}
              >
                <span className="text-[15px] w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Network indicator */}
        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-[11px] text-white/40">
            <div className={`w-1.5 h-1.5 rounded-full ${isMainnet ? "bg-ds-green pulse-green" : "bg-yellow-400"}`} />
            <span>{isMainnet ? "Hedera Mainnet" : "Hedera Testnet"}</span>
          </div>
          <div className="mt-2 text-[10px] text-white/20">
            Powered by dappily-agent-kit
          </div>
        </div>
      </aside>
    </>
  );
}
