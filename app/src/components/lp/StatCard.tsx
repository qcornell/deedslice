"use client";

/**
 * StatCard — Financial metric card for LP portal
 * Clean, institutional. Numbers are the star.
 * Supports dark mode via CSS custom properties from portal layout.
 */

interface Props {
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}

export default function StatCard({ label, value, subtitle, className = "" }: Props) {
  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{
        background: "var(--lp-card-bg, #FFFFFF)",
        borderColor: "var(--lp-border, #E2E8F0)",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div
        className="text-[11px] font-medium tracking-wide uppercase mb-1.5"
        style={{ color: "var(--lp-text-muted, #94A3B8)", letterSpacing: "0.04em" }}
      >
        {label}
      </div>
      <div
        className="text-xl font-bold"
        style={{ color: "var(--lp-text, #0F172A)", letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] mt-0.5" style={{ color: "var(--lp-text-muted, #94A3B8)" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
