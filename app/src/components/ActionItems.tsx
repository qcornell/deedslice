"use client";

import { useEffect, useState } from "react";
import { useAuth, getAuthHeaders } from "@/hooks/useAuth";
import Link from "next/link";

interface ActionItem {
  icon: string;
  text: string;
  priority: "red" | "yellow" | "green";
  link?: string;
}

export default function ActionItems() {
  const { session } = useAuth();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/dashboard/action-items", { headers: getAuthHeaders(session) })
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [session]);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-ds-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-sm" style={{ color: "var(--ds-muted)" }}>Checking action items...</span>
        </div>
      </div>
    );
  }

  if (error) return null;

  const dotColor: Record<string, string> = {
    red: "bg-red-500",
    yellow: "bg-yellow-400",
    green: "bg-emerald-400",
  };

  return (
    <div className="glass rounded-2xl p-5 mb-6 animate-fade-in" style={{ borderColor: "var(--ds-border)" }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ds-text)" }}>
        Action Items
      </h3>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ds-muted)" }}>
          ✅ You&apos;re all caught up. No action items.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor[item.priority]}`} />
                <span className="text-sm truncate" style={{ color: "var(--ds-text)" }}>
                  {item.text}
                </span>
              </div>
              {item.link && (
                <Link
                  href={item.link}
                  className="text-xs shrink-0 hover:underline"
                  style={{ color: "var(--ds-accent)" }}
                >
                  →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
