"use client";

/**
 * StatusBadge — Consistent status indicators across LP portal
 * Financial UI: calm, precise, no animation except live dots.
 */

import { STATUS_CONFIG } from "@/lib/design-tokens";

interface Props {
  status: string;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: Props) {
  const config = STATUS_CONFIG[status.toLowerCase()] || {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    bg: "#F1F5F9",
    text: "#64748B",
  };

  const sizeClasses = size === "sm"
    ? "px-2 py-0.5 text-[10px]"
    : "px-2.5 py-1 text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium ${sizeClasses}`}
      style={{ background: config.bg, color: config.text }}
    >
      {config.dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: config.text }}
        />
      )}
      {config.label}
    </span>
  );
}
