"use client";

import { BarList } from "./BarList";
import { useAggregatePolling } from "./useAggregatePolling";

type Props = { query: string };

interface ApiItem {
  hashtag: string;
  count: number;
}

export function TopHashtagsChart({ query }: Props) {
  const url = query
    ? `/api/analytics/hashtags?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items: rawItems, loading, error } = useAggregatePolling<ApiItem>(url);
  const items = rawItems.map((d) => ({ label: d.hashtag, value: d.count }));

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );

  return <BarList items={items} loading={loading} maxItems={10} />;
}
