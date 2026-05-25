"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useSummaryField } from "./SummaryProvider";

type Props = { query: string };

export function BotRatioChart({ query: _query }: Props) {
  const { data, loading, error } = useSummaryField("botRatio");

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const botPct = data?.automatedPercentage ?? 0;
  const total = (data?.automated ?? 0) + (data?.notAutomated ?? 0);

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
    <div style={{ marginTop: 8 }}>
      {/* Big percentage */}
      <div
        style={{
          font: "700 36px/1 var(--font-mono)",
          color: "var(--fg-1)",
          letterSpacing: "-0.02em",
          marginBottom: 4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {botPct}%
      </div>
      {/* Eyebrow hint with tooltip */}
      <div
        title="Estimate based on Twitter flags + behavioural heuristics"
        style={{
          font: "500 11px var(--font-mono)",
          color: "var(--fg-4)",
          marginBottom: 12,
          cursor: "help",
          borderBottom: "1px dotted var(--border)",
          display: "inline-block",
        }}
      >
        estimated automated accounts
      </div>

      {/* Two-segment bar */}
      <div
        style={{
          display: "flex",
          height: 14,
          borderRadius: 3,
          overflow: "hidden",
          gap: 1,
        }}
      >
        <div
          title={`Bot: ${botPct}%`}
          style={{
            width: `${botPct}%`,
            background: "#ef4444",
            opacity: 0.75,
            minWidth: botPct > 0 ? 2 : 0,
          }}
        />
        <div
          title={`Human: ${(100 - botPct).toFixed(1)}%`}
          style={{
            flex: 1,
            background: "#22c55e",
            opacity: 0.6,
          }}
        />
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "#ef4444",
              opacity: 0.75,
            }}
          />
          <span style={{ font: "500 11px var(--font-mono)", color: "var(--fg-3)" }}>
            Bot {botPct}%
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: "#22c55e",
              opacity: 0.6,
            }}
          />
          <span style={{ font: "500 11px var(--font-mono)", color: "var(--fg-3)" }}>
            Human {(100 - botPct).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
