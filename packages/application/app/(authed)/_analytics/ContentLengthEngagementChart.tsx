"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useSummaryField } from "./SummaryProvider";
import { Scatter, type ScatterPoint } from "./Scatter";

type Props = { query: string };

export function ContentLengthEngagementChart({ query: _query }: Props) {
  const { data, loading, error } = useSummaryField("contentLengthEngagement");

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const raw = data?.points ?? [];

  const points: ScatterPoint[] = raw.map((p) => ({
    x: p.length,
    y: p.engagement,
    label: `length ${p.length} · engagement ${p.engagement}`,
  }));

  return (
    <div>
      <Scatter
        points={points}
        xLabel="tweet length (chars)"
        yLabel="engagement"
        height={240}
        loading={loading && raw.length === 0}
      />
      {data?.truncated && (
        <div
          style={{
            marginTop: 4,
            font: "500 10px var(--font-mono)",
            color: "var(--fg-4)",
            textAlign: "center",
          }}
        >
          sampled from {">"}2 000 tweets
        </div>
      )}
    </div>
  );
}
