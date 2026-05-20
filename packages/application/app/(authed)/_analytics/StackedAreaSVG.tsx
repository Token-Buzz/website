"use client";

// Shared stacked-area SVG primitive used by EngagementTimeSeries and SentimentTimeline.
// Each series is a named key in the data rows; colors and labels are passed via `series`.

export interface StackedAreaRow {
  label: string; // x-axis label (formatted time)
  [key: string]: number | string; // series values
}

export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
}

interface StackedAreaSVGProps {
  rows: StackedAreaRow[];
  series: SeriesConfig[];
  height?: number;
  stacked?: boolean; // true = stacked area, false = independent areas (not used but kept for API completeness)
  percentMode?: boolean; // normalise each column to 100 %
}

const PADDING = { top: 16, right: 12, bottom: 28, left: 36 };

function fmt(label: string): string {
  // label is an ISO string like "2026-05-19T14:00:00.000Z" — show HH:MM or Mon/DD
  try {
    const d = new Date(label);
    const diff =
      typeof window !== "undefined"
        ? Date.now() - d.getTime()
        : 0;
    if (diff < 48 * 3600 * 1000) {
      return new Intl.DateTimeFormat("en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d);
    }
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
  } catch {
    return label.slice(0, 5);
  }
}

export function StackedAreaSVG({
  rows,
  series,
  height = 200,
  percentMode = false,
}: StackedAreaSVGProps) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "500 12px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        No data
      </div>
    );
  }

  // Build stacked totals per row
  type NumericRow = { label: string; values: number[] };
  const numeric: NumericRow[] = rows.map((row) => ({
    label: row.label,
    values: series.map((s) => {
      const v = row[s.key];
      return typeof v === "number" ? v : 0;
    }),
  }));

  // If percentMode, normalise each row so values sum to 100
  const normalised: NumericRow[] = percentMode
    ? numeric.map((row) => {
        const total = row.values.reduce((a, b) => a + b, 0) || 1;
        return { label: row.label, values: row.values.map((v) => (v / total) * 100) };
      })
    : numeric;

  // For stacked areas we compute cumulative sums per row
  const stacks: number[][] = normalised.map((row) => {
    const cum: number[] = [];
    let acc = 0;
    for (const v of row.values) {
      acc += v;
      cum.push(acc);
    }
    return cum;
  });

  const maxVal = percentMode ? 100 : Math.max(...stacks.map((s) => s[s.length - 1] || 0), 1);

  const width = 480; // SVG logical width; scaled to 100% via CSS
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const xOf = (colIdx: number) =>
    PADDING.left + (colIdx / Math.max(rows.length - 1, 1)) * innerW;
  const yOf = (val: number) => PADDING.top + (1 - val / maxVal) * innerH;

  // Build path data for each series layer (upper edge of each stack level)
  function polyPath(upperValues: number[], lowerValues: number[]): string {
    // forward across top edge, backward along bottom edge
    const top = upperValues.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" L ");
    const bot = lowerValues
      .map((v, i) => `${xOf(i)},${yOf(v)}`)
      .reverse()
      .join(" L ");
    return `M ${top} L ${bot} Z`;
  }

  // Y axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount }, (_, i) =>
    (maxVal * i) / (yTickCount - 1),
  );

  // X axis ticks — show at most 6 labels
  const xTickStep = Math.ceil(rows.length / 6);
  const xTickIndices = rows
    .map((_, i) => i)
    .filter((i) => i % xTickStep === 0 || i === rows.length - 1);

  return (
    <div style={{ width: "100%" }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible" }}
      >
        {/* Y axis grid + ticks */}
        {yTicks.map((v, i) => (
          <g key={`yt-${i}`}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + innerW}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="2,4"
              opacity={0.5}
            />
            <text
              x={PADDING.left - 4}
              y={yOf(v)}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ font: "500 9px var(--font-mono)", fill: "var(--fg-4)" }}
            >
              {percentMode ? `${Math.round(v)}%` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)}
            </text>
          </g>
        ))}

        {/* Stacked areas — draw from bottom series upward */}
        {series.map((s, si) => {
          const upper = stacks.map((col) => col[si]);
          const lower = si === 0 ? stacks.map(() => 0) : stacks.map((col) => col[si - 1]);
          return (
            <path
              key={s.key}
              d={polyPath(upper, lower)}
              fill={s.color}
              opacity={0.72}
            />
          );
        })}

        {/* Axes */}
        <line
          x1={PADDING.left}
          x2={PADDING.left + innerW}
          y1={PADDING.top + innerH}
          y2={PADDING.top + innerH}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <line
          x1={PADDING.left}
          x2={PADDING.left}
          y1={PADDING.top}
          y2={PADDING.top + innerH}
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* X axis labels */}
        {xTickIndices.map((i) => (
          <text
            key={`xl-${i}`}
            x={xOf(i)}
            y={height - 4}
            textAnchor="middle"
            style={{ font: "500 9px var(--font-mono)", fill: "var(--fg-4)" }}
          >
            {fmt(rows[i].label)}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 14px",
          marginTop: 6,
        }}
      >
        {series.map((s) => (
          <div
            key={s.key}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                font: "500 11px var(--font-mono)",
                color: "var(--fg-3)",
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
