"use client";

import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-ds-border flex items-center justify-between px-8 bg-ds-card/50 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-ds-muted">{user.email}</span>
            <button
              onClick={signOut}
              className="text-xs text-ds-muted hover:text-ds-text transition px-3 py-1.5 rounded border border-ds-border hover:border-ds-muted"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    </header>
  );
}
