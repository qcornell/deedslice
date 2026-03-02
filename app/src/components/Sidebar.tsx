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
    <aside className="fixed left-0 top-0 h-screen w-64 bg-ds-card border-r border-ds-border flex flex-col z-40">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-ds-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ds-accent to-ds-orange flex items-center justify-center text-white font-bold text-sm">
            DS
          </div>
          <span className="text-lg font-semibold">DeedSlice</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium
                ${active
                  ? "bg-ds-accent/15 text-ds-accent-light border border-ds-accent/20"
                  : "text-ds-muted hover:text-ds-text hover:bg-white/5"
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Network indicator */}
      <div className="p-4 border-t border-ds-border">
        <div className="flex items-center gap-2 text-xs text-ds-muted">
          <div className="w-2 h-2 rounded-full bg-ds-green pulse-green" />
          <span>Hedera Testnet</span>
        </div>
        <div className="mt-2 text-[10px] text-ds-muted/60">
          Powered by dappily-agent-kit
        </div>
      </div>
    </aside>
  );
}
