"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { href: "/dashboard", label: "Properties", icon: "🏠" },
  { href: "/dashboard/new", label: "Tokenize", icon: "⚡" },
  { href: "/dashboard/investors", label: "Investors", icon: "👥" },
  { href: "/dashboard/audit", label: "Audit Trail", icon: "📋" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-ds-navy flex flex-col z-40" style={{
      background: "linear-gradient(180deg, #0F172A 0%, #162032 100%)",
    }}>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
        <a href="https://deedslice.com" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{
            background: "linear-gradient(135deg, #0D9488, #e17055)",
            boxShadow: "0 2px 8px rgba(13,148,136,0.3)",
          }}>
            DS
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">DeedSlice</span>
        </a>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 mt-2">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
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
          <div className="w-1.5 h-1.5 rounded-full bg-ds-green pulse-green" />
          <span>Hedera Testnet</span>
        </div>
        <div className="mt-2 text-[10px] text-white/20">
          Powered by dappily-agent-kit
        </div>
      </div>
    </aside>
  );
}
