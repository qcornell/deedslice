"use client";

import { useAuth } from "@/hooks/useAuth";

interface Props {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: Props) {
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 border-b flex items-center justify-between px-4 md:px-8" style={{
      background: "rgba(255,255,255,0.75)",
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
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--ds-muted)" }}>Console</span>
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {user && (
          <>
            <span className="text-[12px] md:text-[13px] font-medium hidden sm:inline" style={{ color: "var(--ds-text-secondary)" }}>
              {user.email}
            </span>
            <button
              onClick={signOut}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all"
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
          </>
        )}
      </div>
    </header>
  );
}
