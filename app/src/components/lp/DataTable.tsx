"use client";

/**
 * DataTable — Clean financial data table for LP portal
 * Consistent headers, row hover, optional on-chain links.
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

export default function DataTable<T>({ columns, data, emptyMessage = "No data.", keyExtractor }: Props<T>) {
  if (data.length === 0) {
    return (
      <div
        className="bg-white rounded-xl border p-8 text-center"
        style={{ borderColor: "#E2E8F0" }}
      >
        <p className="text-[13px]" style={{ color: "#94A3B8" }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden"
      style={{ borderColor: "#E2E8F0", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-[10px] font-semibold tracking-wide uppercase"
                style={{
                  color: "#94A3B8",
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
          {data.map(row => (
            <tr
              key={keyExtractor(row)}
              className="transition-colors"
              style={{ borderBottom: "1px solid #F8FAFC" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#FAFBFC")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-[13px]"
                  style={{ textAlign: col.align || "left", color: "#0F172A" }}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
