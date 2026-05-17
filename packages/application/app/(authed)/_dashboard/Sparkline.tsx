"use client";

import { useId } from "react";

interface SparklineProps {
  points: number[];
  color: string;
  width: number;
  height: number;
  fill?: boolean;
}

export function Sparkline({
  points,
  color,
  width,
  height,
  fill = false,
}: SparklineProps) {
  const id = useId();
  const gradientId = `grad-${id.replace(/:/g, "")}`;

  if (points.length === 0) {
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <rect width={width} height={height} fill="transparent" />
      </svg>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const xStep = (width - 4) / Math.max(points.length - 1, 1);
  const pathPoints = points.map((val, i) => {
    const x = 2 + i * xStep;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return `${x},${y}`;
  });

  const pathData = `M ${pathPoints.join(" L ")}`;

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block" }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {fill && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
      )}

      {fill && (
        <path
          d={`${pathData} L ${2 + (points.length - 1) * xStep},${height} L 2,${height} Z`}
          fill={`url(#${gradientId})`}
        />
      )}

      <path
        d={pathData}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
