"use client";

import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-ds-border flex items-center justify-between px-8 bg-white/80 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ds-muted font-medium tracking-wide uppercase">Console</span>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-ds-text-secondary font-medium">{user.email}</span>
            <button
              onClick={signOut}
              className="text-xs text-ds-muted hover:text-ds-text transition px-3 py-1.5 rounded-lg border border-ds-border hover:border-ds-accent hover:text-ds-accent-text"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
