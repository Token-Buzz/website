"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";

type Props = { query: string };

interface ApiResponse {
  blue: number;
  business: number;
  government: number;
  unverified: number;
}

const SEGMENTS = [
  { key: "blue" as const, label: "Blue", color: "#3b82f6" },
  { key: "business" as const, label: "Business", color: "#f59e0b" },
  { key: "government" as const, label: "Government", color: "#6366f1" },
  { key: "unverified" as const, label: "Unverified", color: "var(--fg-5, #9ca3af)" },
];

export function VerificationBreakdownChart({ query }: Props) {
  const url = query
    ? `/api/analytics/verification-breakdown?query=${encodeURIComponent(query)}&window=24H`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url);

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const counts = {
    blue: data?.blue ?? 0,
    business: data?.business ?? 0,
    government: data?.government ?? 0,
    unverified: data?.unverified ?? 0,
  };
  const total = counts.blue + counts.business + counts.government + counts.unverified;

  if (total === 0) {
    return (
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          font: "500 12px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        No data
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Stacked horizontal bar */}
      <div
        style={{
          display: "flex",
          height: 18,
          borderRadius: 4,
          overflow: "hidden",
          gap: 1,
        }}
      >
        {SEGMENTS.map(({ key, color }) => {
          const pct = (counts[key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              title={`${SEGMENTS.find((s) => s.key === key)?.label}: ${Math.round(pct)}%`}
              style={{
                width: `${pct}%`,
                background: color,
                opacity: 0.8,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          marginTop: 10,
        }}
      >
        {SEGMENTS.map(({ key, label, color }) => {
          const pct = total > 0 ? Math.round((counts[key] / total) * 100) : 0;
          return (
            <div
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  font: "500 11px var(--font-mono)",
                  color: "var(--fg-3)",
                }}
              >
                {label} {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
