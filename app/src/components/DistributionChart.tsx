"use client";

import { useEffect, useState, useMemo } from "react";
import { getAuthHeaders } from "@/hooks/useAuth";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Property } from "@/types/database";

/* ═══════════════════════════════════════════════════════════════
 *  Distribution Income — Area chart for the dashboard
 *  Fetches distribution data per live property, aggregates by
 *  month, and renders a smooth teal gradient area chart.
 *  Falls back to sample data when no distributions exist yet.
 * ═══════════════════════════════════════════════════════════════ */

interface Session {
  access_token: string;
  refresh_token: string;
  user: { id: string; [key: string]: any };
  [key: string]: any;
}

interface Props {
  properties: Property[];
  session: Session | null;
}

interface MonthPoint {
  month: string; // "Jan", "Feb", …
  amount: number;
}

const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

/** Build 7 month buckets ending on current month */
function last7Months(): { key: string; label: string }[] {
  const now = new Date();
  const buckets: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ key, label: MONTH_ABBR[d.getMonth()] });
  }
  return buckets;
}

const SAMPLE_DATA: MonthPoint[] = [
  { month: "Jan", amount: 2400 },
  { month: "Feb", amount: 2800 },
  { month: "Mar", amount: 3100 },
  { month: "Apr", amount: 2900 },
  { month: "May", amount: 3500 },
  { month: "Jun", amount: 4200 },
  { month: "Jul", amount: 4800 },
];

function formatYAxis(val: number): string {
  if (val >= 1000) {
    const k = val / 1000;
    return `$${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `$${val}`;
}

function formatTooltip(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DistributionChart({ properties, session }: Props) {
  const [realData, setRealData] = useState<MonthPoint[] | null>(null);
  const [loading, setLoading] = useState(true);

  const liveProperties = useMemo(
    () => properties.filter((p) => p.status === "live"),
    [properties],
  );

  useEffect(() => {
    if (!session || liveProperties.length === 0) {
      setLoading(false);
      return;
    }

    const h = getAuthHeaders(session);
    const buckets = last7Months();

    // Fetch distributions for every live property
    Promise.all(
      liveProperties.map((p) =>
        fetch(`/api/distributions?propertyId=${p.id}&limit=100`, { headers: h })
          .then((r) => r.json())
          .then((d) => d.distributions || [])
          .catch(() => []),
      ),
    )
      .then((results) => {
        const all = results.flat();
        if (all.length === 0) {
          setRealData(null);
          setLoading(false);
          return;
        }

        // Aggregate by YYYY-MM using paid_at (preferred) or created_at
        const monthTotals = new Map<string, number>();
        for (const dist of all) {
          const dateStr: string = dist.paid_at || dist.created_at;
          if (!dateStr) continue;
          const d = new Date(dateStr);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          monthTotals.set(key, (monthTotals.get(key) || 0) + Number(dist.amount_usd || 0));
        }

        const points: MonthPoint[] = buckets.map((b) => ({
          month: b.label,
          amount: Math.round((monthTotals.get(b.key) || 0) * 100) / 100,
        }));

        // Check if there's any nonzero value in the window
        const hasData = points.some((p) => p.amount > 0);
        setRealData(hasData ? points : null);
        setLoading(false);
      })
      .catch(() => {
        setRealData(null);
        setLoading(false);
      });
  }, [session, liveProperties]);

  const isSample = realData === null;
  const chartData = isSample ? SAMPLE_DATA : realData;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 260 }}>
        <div className="w-6 h-6 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const strokeColor = isSample ? "#94A3B8" : "#0D9488";
  const gradientStart = isSample ? "rgba(148,163,184,0.15)" : "rgba(13,148,136,0.2)";
  const gradientEnd = isSample ? "rgba(148,163,184,0.02)" : "rgba(13,148,136,0.02)";
  const gridColor = "#E3E8EF";

  return (
    <div className="relative">
      {isSample && (
        <div
          className="absolute top-2 right-2 z-10 px-3 py-1.5 rounded-md text-[12px] font-medium"
          style={{
            background: "rgba(148,163,184,0.10)",
            color: "#697386",
            border: "1px solid rgba(148,163,184,0.18)",
          }}
        >
          Sample data — record your first distribution to see real numbers
        </div>
      )}

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="distributionGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradientStart} stopOpacity={1} />
              <stop offset="100%" stopColor={gradientEnd} stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={gridColor}
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="month"
            tick={{ fontSize: 13, fill: "#697386" }}
            tickLine={false}
            axisLine={{ stroke: gridColor }}
          />

          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 13, fill: "#697386" }}
            tickLine={false}
            axisLine={false}
            width={55}
          />

          <Tooltip
            formatter={(value: number) => [formatTooltip(value), "Income"]}
            contentStyle={{
              background: "#fff",
              border: "1px solid #E3E8EF",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              fontSize: 13,
              color: "#1A1F36",
            }}
            labelStyle={{ color: "#697386", fontWeight: 500 }}
            cursor={{ stroke: strokeColor, strokeWidth: 1, strokeDasharray: "4 4" }}
          />

          <Area
            type="monotone"
            dataKey="amount"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#distributionGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: strokeColor,
              stroke: "#fff",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
