"use client";

import { BarList } from "./BarList";
import { useSummaryItems } from "./SummaryProvider";

type Props = { query: string };

export function TopMentionsChart({ query: _query }: Props) {
  const { items: rawItems, loading, error } = useSummaryItems("mentions");
  const items = rawItems.map((d) => ({ label: d.mention, value: d.count }));

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );

  return <BarList items={items} loading={loading} maxItems={10} />;
}
