"use client";

import type { SocialSource } from "@monorepo-template/core/sources/types";
import { useSummaryContext } from "./SummaryProvider";
import { SOURCE_META } from "./sources";

interface SourceChipsProps {
  query: string;
  selected: SocialSource | "all";
  onSelect: (s: SocialSource | "all") => void;
}

export function SourceChips({ query, selected, onSelect }: SourceChipsProps) {
  const { data } = useSummaryContext();

  if (!query) return null;

  const sourceCounts: Record<string, number> = data?.sourceCounts ?? {};

  // Total across all implemented sources
  const total = Object.values(sourceCounts).reduce((sum, n) => sum + n, 0);

  const chipBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    font: "500 12px var(--font-sans)",
    cursor: "pointer",
    background: "transparent",
    transition: "border-color 120ms, color 120ms, background 120ms",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  const selectedStyle: React.CSSProperties = {
    borderColor: "var(--buzz-500)",
    color: "var(--fg-1)",
    background: "rgba(var(--buzz-500-rgb, 99,102,241), 0.08)",
  };

  const unselectedStyle: React.CSSProperties = {
    color: "var(--fg-3)",
  };

  const countStyle: React.CSSProperties = {
    font: "500 11px var(--font-mono)",
    color: "var(--fg-3)",
    opacity: 0.8,
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        alignItems: "center",
      }}
    >
      {/* All chip */}
      <button
        type="button"
        onClick={() => onSelect("all")}
        style={{
          ...chipBase,
          ...(selected === "all" ? selectedStyle : unselectedStyle),
        }}
        title="All sources"
      >
        <span>All</span>
        {total > 0 && (
          <span style={countStyle}>{total.toLocaleString()}</span>
        )}
      </button>

      {/* Per-source chips */}
      {SOURCE_META.map((meta) => {
        const count = sourceCounts[meta.id] ?? 0;

        if (!meta.implemented) {
          const tierLabel =
            meta.minPlan === "free"
              ? "Coming soon"
              : meta.minPlan === "pro"
              ? "Coming soon · requires Pro"
              : "Coming soon · requires Alpha";

          return (
            <span
              key={meta.id}
              title={tierLabel}
              style={{
                ...chipBase,
                cursor: "default",
                opacity: 0.45,
                borderStyle: "dashed",
                gap: 5,
              }}
            >
              <span style={{ color: "var(--fg-3)" }}>{meta.displayName}</span>
              <span
                style={{
                  font: "600 9px var(--font-sans)",
                  color: "var(--fg-3)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                Soon
              </span>
            </span>
          );
        }

        return (
          <button
            key={meta.id}
            type="button"
            onClick={() => onSelect(meta.id)}
            style={{
              ...chipBase,
              ...(selected === meta.id ? selectedStyle : unselectedStyle),
            }}
            title={meta.displayName}
          >
            <span>{meta.displayName}</span>
            <span style={countStyle}>{count.toLocaleString()}</span>
          </button>
        );
      })}
    </div>
  );
}
