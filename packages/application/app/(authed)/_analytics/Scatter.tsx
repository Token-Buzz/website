"use client";

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
}

interface ScatterProps {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  width?: number;
  height?: number;
  loading?: boolean;
  emptyState?: React.ReactNode;
}

const PADDING = { top: 24, right: 16, bottom: 32, left: 40 };

function computeDomain(values: number[], padding = 0.08): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return [min - range * padding, max + range * padding];
}

export function Scatter({
  points,
  xLabel,
  yLabel,
  width = 480,
  height = 280,
  loading = false,
  emptyState = "No data",
}: ScatterProps) {
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  if (loading) {
    return (
      <div
        style={{
          width,
          height,
          maxWidth: "100%",
          borderRadius: 6,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Skeleton shimmer rectangle */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, var(--bg-sunken) 0%, var(--border) 50%, var(--bg-sunken) 100%)",
            backgroundSize: "200% 100%",
            animation: "tb-skeleton-shimmer 1.4s linear infinite",
          }}
        />
        {/* Axis placeholders */}
        <div
          style={{
            position: "absolute",
            bottom: PADDING.bottom,
            left: PADDING.left,
            right: PADDING.right,
            height: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: PADDING.top,
            bottom: PADDING.bottom,
            left: PADDING.left,
            width: 1,
            background: "var(--border)",
            opacity: 0.5,
          }}
        />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          maxWidth: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          font: "500 12px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        {emptyState}
      </div>
    );
  }

  const [xMin, xMax] = computeDomain(points.map((p) => p.x));
  const [yMin, yMax] = computeDomain(points.map((p) => p.y));

  const toSvgX = (x: number) =>
    PADDING.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const toSvgY = (y: number) =>
    PADDING.top + (1 - (y - yMin) / (yMax - yMin)) * innerH;

  // Generate 4 faint grid lines in each axis
  const xGridCount = 4;
  const yGridCount = 4;
  const xGridLines = Array.from({ length: xGridCount }, (_, i) =>
    xMin + ((xMax - xMin) * i) / (xGridCount - 1),
  );
  const yGridLines = Array.from({ length: yGridCount }, (_, i) =>
    yMin + ((yMax - yMin) * i) / (yGridCount - 1),
  );

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", overflow: "visible" }}
    >
      {/* Grid lines */}
      {xGridLines.map((xVal, i) => (
        <line
          key={`xg-${i}`}
          x1={toSvgX(xVal)}
          x2={toSvgX(xVal)}
          y1={PADDING.top}
          y2={PADDING.top + innerH}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="2,4"
          opacity={0.6}
        />
      ))}
      {yGridLines.map((yVal, i) => (
        <line
          key={`yg-${i}`}
          x1={PADDING.left}
          x2={PADDING.left + innerW}
          y1={toSvgY(yVal)}
          y2={toSvgY(yVal)}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="2,4"
          opacity={0.6}
        />
      ))}

      {/* Axes */}
      {/* X axis */}
      <line
        x1={PADDING.left}
        x2={PADDING.left + innerW}
        y1={PADDING.top + innerH}
        y2={PADDING.top + innerH}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {/* Y axis */}
      <line
        x1={PADDING.left}
        x2={PADDING.left}
        y1={PADDING.top}
        y2={PADDING.top + innerH}
        stroke="var(--border)"
        strokeWidth={1}
      />

      {/* Data points */}
      {points.map((pt, i) => (
        <circle
          key={i}
          cx={toSvgX(pt.x)}
          cy={toSvgY(pt.y)}
          r={3}
          fill="var(--accent, var(--buzz-500))"
          opacity={0.55}
        >
          {pt.label && <title>{pt.label}</title>}
        </circle>
      ))}

      {/* X axis label */}
      <text
        x={PADDING.left + innerW / 2}
        y={height - 4}
        textAnchor="middle"
        style={{
          font: "500 10px var(--font-mono)",
          fill: "var(--fg-4)",
        }}
      >
        {xLabel}
      </text>

      {/* Y axis label */}
      <text
        x={10}
        y={PADDING.top}
        textAnchor="start"
        style={{
          font: "500 10px var(--font-mono)",
          fill: "var(--fg-4)",
        }}
      >
        {yLabel}
      </text>
    </svg>
  );
}
