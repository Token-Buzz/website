"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useAggregatePolling } from "./useAggregatePolling";

type Props = { query: string };

interface HeatmapPoint {
  day: string;
  hour: number;
  count: number;
}

// Fixed day order for rows
const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Log scale normalises the wide dynamic range typical of social activity.
// Linear scale would wash out low-count cells when a few hours dominate.
function logNorm(value: number, maxVal: number): number {
  if (maxVal <= 0 || value <= 0) return 0;
  return Math.log1p(value) / Math.log1p(maxVal);
}

const CELL_W = 16;
const CELL_H = 18;
const CELL_GAP = 2;
const LEFT_LABEL_W = 28;
const BOTTOM_LABEL_H = 16;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function PostingHeatmapChart({ query }: Props) {
  // Returns an array of { day, hour, count } — use useAggregatePolling since
  // the endpoint returns a plain array.
  const url = query
    ? `/api/analytics/posting-heatmap?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items, loading, error } = useAggregatePolling<HeatmapPoint>(url);

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

  // Build lookup map: "day-hour" → count
  const lookup = new Map<string, number>();
  let maxCount = 0;
  for (const pt of items) {
    const key = `${pt.day}-${pt.hour}`;
    const existing = lookup.get(key) ?? 0;
    const merged = existing + pt.count;
    lookup.set(key, merged);
    if (merged > maxCount) maxCount = merged;
  }

  const gridW = LEFT_LABEL_W + HOURS.length * (CELL_W + CELL_GAP) - CELL_GAP;
  const gridH = BOTTOM_LABEL_H + DAY_ORDER.length * (CELL_H + CELL_GAP) - CELL_GAP;
  const svgW = gridW;
  const svgH = gridH + BOTTOM_LABEL_H;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMinYMid meet"
        style={{ display: "block", minWidth: svgW }}
      >
        {/* Day labels (rows) */}
        {DAY_ORDER.map((day, di) => (
          <text
            key={day}
            x={LEFT_LABEL_W - 4}
            y={di * (CELL_H + CELL_GAP) + CELL_H / 2 + 1}
            textAnchor="end"
            dominantBaseline="middle"
            style={{ font: "500 9px var(--font-mono)", fill: "var(--fg-4)" }}
          >
            {day}
          </text>
        ))}

        {/* Hour labels every 3 hours (columns) */}
        {HOURS.filter((h) => h % 3 === 0).map((h) => (
          <text
            key={h}
            x={LEFT_LABEL_W + h * (CELL_W + CELL_GAP) + CELL_W / 2}
            y={svgH - 2}
            textAnchor="middle"
            style={{ font: "500 8px var(--font-mono)", fill: "var(--fg-4)" }}
          >
            {String(h).padStart(2, "0")}
          </text>
        ))}

        {/* Heatmap cells */}
        {DAY_ORDER.map((day, di) =>
          HOURS.map((hour) => {
            const count = lookup.get(`${day}-${hour}`) ?? 0;
            const opacity = logNorm(count, maxCount);
            const x = LEFT_LABEL_W + hour * (CELL_W + CELL_GAP);
            const y = di * (CELL_H + CELL_GAP);
            return (
              <rect
                key={`${day}-${hour}`}
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
                rx={2}
                fill="var(--accent, var(--buzz-500))"
                opacity={count === 0 ? 0.06 : 0.1 + opacity * 0.85}
              >
                <title>
                  {day} {String(hour).padStart(2, "0")}:00 — {count} tweet{count !== 1 ? "s" : ""}
                </title>
              </rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}
