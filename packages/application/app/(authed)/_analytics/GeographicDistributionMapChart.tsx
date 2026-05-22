"use client";

// amCharts world SVG URLs returned 403 during build — using bar-list fallback.
// The endpoint returns ISO-2 country codes; flag emoji are constructed via
// regional indicator letters (U+1F1E6+code_point - 0x41 per letter).

import { AnalyzingIndicator } from "./AnalyzingIndicator";
import { useObjectPolling } from "./useAggregatePolling";
import { BarList, type BarListItem } from "./BarList";

type Props = { query: string };

interface CountryEntry {
  country: string;
  count: number;
}

interface ApiResponse {
  countries: CountryEntry[];
  truncated: boolean;
}

// Convert ISO-2 code (e.g. "US") to flag emoji via regional indicator symbols
function isoToFlag(iso2: string): string {
  if (iso2.length !== 2) return "";
  const base = 0x1f1e6 - 0x41; // offset: 'A' → 🇦
  try {
    return String.fromCodePoint(
      iso2.toUpperCase().charCodeAt(0) + base,
      iso2.toUpperCase().charCodeAt(1) + base,
    );
  } catch {
    return "";
  }
}

export function GeographicDistributionMapChart({ query }: Props) {
  const url = query
    ? `/api/analytics/geographic?query=${encodeURIComponent(query)}&window=24H`
    : null;

  const { data, loading, error } = useObjectPolling<ApiResponse>(url, {
    isPopulated: (d) => d.countries.length > 0,
  });

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>Failed to load: {error}</div>
    );

  if (loading && !data) return <AnalyzingIndicator />;

  const entries = data?.countries ?? [];

  const items: BarListItem[] = entries.slice(0, 15).map((entry, i) => ({
    rank: i + 1,
    label: `${isoToFlag(entry.country)} ${entry.country}`,
    value: entry.count,
  }));

  return (
    <div>
      <BarList items={items} loading={loading && entries.length === 0} maxItems={15} />
      {data?.truncated && (
        <div
          style={{
            marginTop: 8,
            font: "500 10px var(--font-mono)",
            color: "var(--fg-4)",
          }}
        >
          capped at 2 000 tweets
        </div>
      )}
    </div>
  );
}
