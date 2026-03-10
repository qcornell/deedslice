"use client";

/**
 * DataTable — Clean financial data table for LP portal
 * Responsive: full table on desktop (≥768px), stacked cards on mobile.
 * Supports dark mode via CSS custom properties from portal layout.
 */

import { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  keyExtractor: (row: T) => string;
}

/* ── Mobile card for a single row ── */
function MobileCard<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  return (
    <div
      className="rounded-lg border p-4 transition-colors"
      style={{
        background: "var(--lp-card-bg, #FFFFFF)",
        borderColor: "var(--lp-border-subtle, #F1F5F9)",
      }}
    >
      {columns.map((col, i) => (
        <div
          key={col.key}
          className="flex items-baseline justify-between gap-4"
          style={{
            padding: "6px 0",
            borderBottom:
              i < columns.length - 1
                ? "1px solid var(--lp-border-subtle, #F8FAFC)"
                : "none",
          }}
        >
          {/* Label */}
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              color: "var(--lp-text-muted, #94A3B8)",
              letterSpacing: "0.06em",
            }}
          >
            {col.header}
          </span>
          {/* Value */}
          <span
            className="text-[13px] text-right"
            style={{ color: "var(--lp-text, #0F172A)" }}
          >
            {col.render(row)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ── */
export default function DataTable<T>({
  columns,
  data,
  emptyMessage = "No data.",
  keyExtractor,
}: Props<T>) {
  /* Empty state — shared across breakpoints */
  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center"
        style={{
          background: "var(--lp-card-bg, #FFFFFF)",
          borderColor: "var(--lp-border, #E2E8F0)",
        }}
      >
        <p
          className="text-[13px]"
          style={{ color: "var(--lp-text-muted, #94A3B8)" }}
        >
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: stacked cards (< 768px) ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.map((row) => (
          <MobileCard key={keyExtractor(row)} row={row} columns={columns} />
        ))}
      </div>

      {/* ── Desktop: full table (≥ 768px) ── */}
      <div
        className="hidden md:block rounded-xl border overflow-hidden"
        style={{
          background: "var(--lp-card-bg, #FFFFFF)",
          borderColor: "var(--lp-border, #E2E8F0)",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
        }}
      >
        <table className="w-full">
          <thead>
            <tr
              style={{
                borderBottom:
                  "1px solid var(--lp-border-subtle, #F1F5F9)",
              }}
            >
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-[10px] font-semibold tracking-wide uppercase"
                  style={{
                    color: "var(--lp-text-muted, #94A3B8)",
                    textAlign: col.align || "left",
                    letterSpacing: "0.06em",
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="transition-colors"
                style={{
                  borderBottom:
                    "1px solid var(--lp-border-subtle, #F8FAFC)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--lp-hover-row, #FAFBFC)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "")
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-[13px]"
                    style={{
                      textAlign: col.align || "left",
                      color: "var(--lp-text, #0F172A)",
                    }}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
