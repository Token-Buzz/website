"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useSummaryField } from "./SummaryProvider";

type Props = { query: string };

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 28;
  const max = Math.max(...points, 1);
  const step = w / (points.length - 1);

  const d = points
    .map((v, i) => {
      const x = i * step;
      const y = h - (v / max) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 10 }}
    >
      <path d={d} fill="none" stroke="var(--accent, var(--buzz-500))" strokeWidth={1.5} opacity={0.7} />
    </svg>
  );
}

export function SymbolRateChart({ query: _query }: Props) {
  const { data, loading, error } = useSummaryField("symbolRate");

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  if (!data) {
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

  // Convert tweets/min to tweets/hour for display
  const tweetsPerHour = Math.round(data.rate * 60 * 10) / 10;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            font: "700 36px/1 var(--font-mono)",
            color: "var(--fg-1)",
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {tweetsPerHour.toLocaleString()}
        </span>
        <span
          style={{
            font: "500 12px var(--font-mono)",
            color: "var(--fg-4)",
          }}
        >
          tweets / hour
        </span>
        {data.sparkline && data.sparkline.length >= 2 && (
          <Sparkline points={data.sparkline} />
        )}
      </div>
      <div
        style={{
          marginTop: 6,
          font: "500 10px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        24-hour rolling average
      </div>
    </div>
  );
}
