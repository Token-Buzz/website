"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";

type Props = { query: string };

interface ThreadBin {
  depth: string;
  count: number;
}

interface ApiResponse {
  threads: ThreadBin[];
  truncated: boolean;
}

export function ConversationDepthChart({ query }: Props) {
  const url = query
    ? `/api/analytics/conversation-threads?query=${encodeURIComponent(query)}&window=24H`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url);

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const bins = data?.threads ?? [];

  if (bins.length === 0) {
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

  const maxCount = Math.max(...bins.map((b) => b.count), 1);
  const chartH = 160;
  const chartW = 400;
  const barPad = 8;
  const barW = Math.floor((chartW - barPad * 2) / bins.length) - barPad;

  return (
    <div style={{ width: "100%" }}>
      <svg
        width="100%"
        height={chartH + 24}
        viewBox={`0 0 ${chartW} ${chartH + 24}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        {bins.map((bin, i) => {
          const barH = Math.max(2, (bin.count / maxCount) * chartH);
          const x = barPad + i * (barW + barPad);
          const y = chartH - barH;
          return (
            <g key={bin.depth}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill="var(--accent, var(--buzz-500))"
                opacity={0.7}
                rx={2}
              >
                <title>
                  depth {bin.depth}: {bin.count} thread{bin.count !== 1 ? "s" : ""}
                </title>
              </rect>
              {/* Count label above bar */}
              {bin.count > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 3}
                  textAnchor="middle"
                  style={{ font: "500 9px var(--font-mono)", fill: "var(--fg-3)" }}
                >
                  {bin.count}
                </text>
              )}
              {/* Depth label below axis */}
              <text
                x={x + barW / 2}
                y={chartH + 14}
                textAnchor="middle"
                style={{ font: "500 9px var(--font-mono)", fill: "var(--fg-4)" }}
              >
                {bin.depth}
              </text>
            </g>
          );
        })}
        {/* X axis line */}
        <line
          x1={barPad}
          x2={chartW - barPad}
          y1={chartH}
          y2={chartH}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </svg>
      <div
        style={{
          marginTop: 4,
          font: "500 10px var(--font-mono)",
          color: "var(--fg-4)",
          textAlign: "center",
        }}
      >
        thread reply depth (tweets per thread)
        {data?.truncated ? " · capped at 2 000 tweets" : ""}
      </div>
    </div>
  );
}
