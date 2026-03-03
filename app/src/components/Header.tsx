"use client";

import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-14 border-b flex items-center justify-between px-8" style={{
      background: "rgba(255,255,255,0.75)",
      backdropFilter: "blur(16px) saturate(180%)",
      WebkitBackdropFilter: "blur(16px) saturate(180%)",
      borderColor: "var(--ds-border)",
    }}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "var(--ds-muted)" }}>Console</span>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-[13px] font-medium" style={{ color: "var(--ds-text-secondary)" }}>{user.email}</span>
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
