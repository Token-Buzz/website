"use client";

import { BarList } from "./BarList";
import { useAggregatePolling } from "./useAggregatePolling";

type Props = { query: string };

interface ApiItem {
  mention: string;
  count: number;
}

export function TopMentionsChart({ query }: Props) {
  const url = query
    ? `/api/analytics/mentions?query=${encodeURIComponent(query)}&window=7D`
    : null;

  const { items: rawItems, loading, error } = useAggregatePolling<ApiItem>(url);
  const items = rawItems.map((d) => ({ label: d.mention, value: d.count }));

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );

  return <BarList items={items} loading={loading} maxItems={10} />;
}
