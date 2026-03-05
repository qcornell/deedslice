"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePathname } from "next/navigation";

interface Props {
  onMenuToggle?: () => void;
}

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/properties": "Properties",
  "/dashboard/new": "Tokenize Property",
  "/dashboard/investors": "Investors",
  "/dashboard/distributions": "Distributions",
  "/dashboard/audit": "Audit Trail",
  "/dashboard/settings": "Settings",
};

export default function Header({ onMenuToggle }: Props) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  const title = pageTitles[pathname] || "Console";

  return (
    <header className="h-16 border-b flex items-center justify-between px-6 md:px-8 sticky top-0 z-[100]" style={{
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      borderColor: "var(--ds-border)",
    }}>
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden text-ds-muted hover:text-ds-text p-1 -ml-1"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-[18px] font-semibold" style={{ color: "var(--ds-text)" }}>{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <button
            onClick={signOut}
            className="text-[13px] font-medium px-4 py-2 rounded-lg border transition-all"
            style={{
              color: "var(--ds-muted)",
              borderColor: "var(--ds-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--ds-accent)";
              e.currentTarget.style.color = "var(--ds-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--ds-border)";
              e.currentTarget.style.color = "var(--ds-muted)";
            }}
          >
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}
