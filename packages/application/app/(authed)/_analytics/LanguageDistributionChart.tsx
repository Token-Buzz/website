"use client";

import { BarList } from "./BarList";
import { useSummaryItems } from "./SummaryProvider";

type Props = { query: string };

export function LanguageDistributionChart({ query: _query }: Props) {
  const { items: rawItems, loading, error } = useSummaryItems("languages");
  const items = rawItems.map((d) => ({ label: d.language, value: d.count }));

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );

  return <BarList items={items} loading={loading} maxItems={10} />;
}
