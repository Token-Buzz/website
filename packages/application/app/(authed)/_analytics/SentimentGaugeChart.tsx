"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";

type Props = { query: string };

interface ApiResponse {
  positive: number;
  neutral: number;
  negative: number;
  // averageScore: (positive - negative) / total × 100, range -100..+100
  averageScore: number;
}

// Convert a score in -1..+1 (api returns float in that range) to 0..180 degrees.
// Score -1 → 0° (leftmost / bear), 0 → 90° (top / neutral), +1 → 180° (rightmost / bull).
function scoreToDeg(score: number): number {
  const clamped = Math.max(-1, Math.min(1, score));
  return (clamped + 1) * 90;
}

// Polar to cartesian for SVG arc drawing
function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

// Build an SVG arc path for a semicircle segment (0° = left, 180° = right)
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// Needle SVG path from centre to tip
function needlePath(cx: number, cy: number, len: number, angleDeg: number): string {
  const tip = polar(cx, cy, len, angleDeg);
  // Small base width — perpendicular points
  const baseAngle = angleDeg + 90;
  const baseRad = (baseAngle * Math.PI) / 180;
  const bw = 3;
  const b1 = { x: cx + bw * Math.cos(baseRad), y: cy + bw * Math.sin(baseRad) };
  const b2 = { x: cx - bw * Math.cos(baseRad), y: cy - bw * Math.sin(baseRad) };
  return `M ${b1.x} ${b1.y} L ${tip.x} ${tip.y} L ${b2.x} ${b2.y} Z`;
}

const W = 240;
const CX = W / 2;
const CY = 130;
const R_OUTER = 90;
const R_INNER = 60;

// Three arcs: bear (red) 0-60°, neutral (amber) 60-120°, bull (green) 120-180°
const ARCS = [
  { start: 0, end: 60, color: "#ef4444" },
  { start: 60, end: 120, color: "#f59e0b" },
  { start: 120, end: 180, color: "#22c55e" },
];

export function SentimentGaugeChart({ query }: Props) {
  const url = query
    ? `/api/analytics/sentiment-aggregation?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url, {
    // averageScore is -1..+1 float; totalTweets not in response — use sum of buckets
    isPopulated: (d) => d.positive + d.neutral + d.negative > 0,
  });

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const total = (data?.positive ?? 0) + (data?.neutral ?? 0) + (data?.negative ?? 0);
  const rawScore = data?.averageScore ?? 0;
  // API returns float -1..+1; convert to display integer -100..+100
  const displayScore = Math.round(rawScore * 100);
  const needleDeg = scoreToDeg(rawScore);

  const tipLen = R_INNER - 4;

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${CY + 20}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", maxWidth: 260 }}
      >
        {/* Outer arc segments */}
        {ARCS.map((arc, i) => (
          <path
            key={i}
            d={arcPath(CX, CY, R_OUTER, arc.start, arc.end)}
            fill="none"
            stroke={arc.color}
            strokeWidth={R_OUTER - R_INNER}
            strokeLinecap="butt"
            opacity={0.82}
          />
        ))}

        {/* Tick marks at arc boundaries */}
        {[0, 60, 120, 180].map((deg) => {
          const inner = polar(CX, CY, R_INNER - 2, deg);
          const outer = polar(CX, CY, R_OUTER + 2, deg);
          return (
            <line
              key={deg}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--bg-base, #000)"
              strokeWidth={1.5}
              opacity={0.6}
            />
          );
        })}

        {/* Needle */}
        <path
          d={needlePath(CX, CY, tipLen, needleDeg)}
          fill="var(--fg-1)"
          opacity={0.9}
        />

        {/* Centre pivot dot */}
        <circle cx={CX} cy={CY} r={5} fill="var(--fg-1)" opacity={0.9} />

        {/* Labels */}
        <text
          x={polar(CX, CY, R_OUTER + 10, 0).x - 2}
          y={polar(CX, CY, R_OUTER + 10, 0).y + 4}
          textAnchor="end"
          style={{ font: "600 9px var(--font-mono)", fill: "#ef4444" }}
        >
          Bear
        </text>
        <text
          x={polar(CX, CY, R_OUTER + 14, 90).x}
          y={polar(CX, CY, R_OUTER + 14, 90).y + 4}
          textAnchor="middle"
          style={{ font: "600 9px var(--font-mono)", fill: "#f59e0b" }}
        >
          Neutral
        </text>
        <text
          x={polar(CX, CY, R_OUTER + 10, 180).x + 2}
          y={polar(CX, CY, R_OUTER + 10, 180).y + 4}
          textAnchor="start"
          style={{ font: "600 9px var(--font-mono)", fill: "#22c55e" }}
        >
          Bull
        </text>
      </svg>

      {/* Score below gauge */}
      <div
        style={{
          marginTop: 4,
          font: "700 32px/1 var(--font-mono)",
          letterSpacing: "-0.02em",
          color:
            displayScore > 10
              ? "#22c55e"
              : displayScore < -10
                ? "#ef4444"
                : "#f59e0b",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayScore > 0 ? "+" : ""}
        {displayScore}
      </div>
      <div
        style={{
          marginTop: 4,
          font: "500 10px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        avg sentiment score · {total.toLocaleString()} tweets
      </div>
    </div>
  );
}
