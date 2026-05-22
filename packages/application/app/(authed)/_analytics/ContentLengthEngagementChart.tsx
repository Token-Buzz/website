"use client";

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";
import { Scatter, type ScatterPoint } from "./Scatter";

type Props = { query: string };

interface ScatterRawPoint {
  length: number;
  engagement: number;
}

interface ApiResponse {
  points: ScatterRawPoint[];
  truncated: boolean;
}

export function ContentLengthEngagementChart({ query }: Props) {
  const url = query
    ? `/api/analytics/content-length-engagement?query=${encodeURIComponent(query)}&window=24H`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url, {
    isPopulated: (d) => d.points.length > 0,
  });

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
