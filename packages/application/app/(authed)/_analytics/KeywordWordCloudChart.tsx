"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useAggregatePolling } from "./useAggregatePolling";

type Props = { query: string };

interface ApiItem {
  keyword: string;
  count: number;
}

export function KeywordWordCloudChart({ query }: Props) {
  const url = query
    ? `/api/analytics/keywords?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items, loading, error } = useAggregatePolling<ApiItem>(url);

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && items.length === 0) return <AnalyzingIndicator />;

  if (items.length === 0) {
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

  const maxCount = Math.max(...items.map((k) => k.count), 1);

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "6px 8px",
        paddingTop: 8,
        alignItems: "center",
      }}
    >
      {items.slice(0, 30).map((k) => {
        // Scale font size 11–26px based on relative frequency
        const ratio = k.count / maxCount;
        const fontSize = Math.round(11 + ratio * 15);
        const opacity = 0.55 + ratio * 0.45;
        return (
          <span
            key={k.keyword}
            title={`${k.keyword}: ${k.count}`}
            style={{
              font: `600 ${fontSize}px/1.2 var(--font-mono)`,
              color: "var(--accent, var(--buzz-500))",
              opacity,
              padding: "2px 5px",
              borderRadius: 4,
              background: "var(--bg-sunken)",
              whiteSpace: "nowrap",
            }}
          >
            {k.keyword}
          </span>
        );
      })}
    </div>
  );
}
