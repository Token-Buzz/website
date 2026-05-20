"use client";

import { fmtCount } from "../_dashboard/primitives";

export interface BarListItem {
  rank?: number;
  label: string;
  value: number;
  formattedValue?: string;
}

interface BarListProps {
  items: BarListItem[];
  maxItems?: number;
  emptyState?: React.ReactNode;
  loading?: boolean;
}

// Skeleton row for loading state
function SkeletonRow({ index }: { index: number }) {
  const widths = ["72%", "55%", "46%", "38%", "30%", "24%", "19%", "15%", "12%", "10%"];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 0",
        animation: "tb-skeleton-pulse 1.4s ease-in-out infinite",
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Rank placeholder */}
      <div
        style={{
          width: 16,
          height: 10,
          borderRadius: 3,
          background: "var(--bg-sunken)",
          flexShrink: 0,
        }}
      />
      {/* Label placeholder */}
      <div
        style={{
          width: 80,
          height: 10,
          borderRadius: 3,
          background: "var(--bg-sunken)",
          flexShrink: 0,
        }}
      />
      {/* Bar placeholder */}
      <div
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: "var(--bg-sunken)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: widths[index % widths.length],
            height: "100%",
            borderRadius: 3,
            background: "var(--border)",
          }}
        />
      </div>
      {/* Value placeholder */}
      <div
        style={{
          width: 40,
          height: 10,
          borderRadius: 3,
          background: "var(--bg-sunken)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

export function BarList({
  items,
  maxItems = 10,
  emptyState = "No data",
  loading = false,
}: BarListProps) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {Array.from({ length: Math.min(maxItems, 5) }).map((_, i) => (
          <SkeletonRow key={i} index={i} />
        ))}
      </div>
    );
  }

  const sliced = items.slice(0, maxItems);

  if (sliced.length === 0) {
    return (
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          font: "500 12px var(--font-mono)",
          color: "var(--fg-4)",
        }}
      >
        {emptyState}
      </div>
    );
  }

  const maxValue = Math.max(...sliced.map((item) => item.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sliced.map((item, index) => {
        const rank = item.rank ?? index + 1;
        const pct = (item.value / maxValue) * 100;
        const display = item.formattedValue ?? fmtCount(item.value);

        return (
          <div
            key={`${item.label}-${index}`}
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {/* Rank */}
            <span
              style={{
                font: "500 11px var(--font-mono)",
                color: "var(--fg-4)",
                width: 16,
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {rank}
            </span>

            {/* Label */}
            <span
              title={item.label}
              style={{
                font: "600 13px var(--font-mono)",
                color: "var(--fg-2)",
                width: 120,
                flexShrink: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>

            {/* Bar track */}
            <div
              style={{
                flex: 1,
                height: 6,
                background: "var(--bg-sunken)",
                borderRadius: 3,
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "var(--accent, var(--buzz-500))",
                  borderRadius: 3,
                  opacity: 0.7,
                  transition: "width 300ms cubic-bezier(0.2,0.7,0.2,1)",
                }}
              />
            </div>

            {/* Value */}
            <span
              style={{
                font: "600 12px var(--font-mono)",
                color: "var(--fg-1)",
                width: 56,
                textAlign: "right",
                flexShrink: 0,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {display}
            </span>
          </div>
        );
      })}
    </div>
  );
}
