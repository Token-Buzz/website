"use client";

import { useEffect, useState } from "react";
import { BarList } from "./BarList";

type Props = { query: string };

interface ApiItem {
  source: string;
  count: number;
}

export function SourceDistributionChart({ query }: Props) {
  const [items, setItems] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    fetch(
      `/api/analytics/source-distribution?query=${encodeURIComponent(query)}&window=7D`
    )
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: ApiItem[]) => {
        if (cancelled) return;
        setItems(data.map((d) => ({ label: d.source, value: d.count })));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (error)
    return (
      <div style={{ color: "#dc2626", fontSize: 13 }}>
        Failed to load: {error}
      </div>
    );

  return (
    <BarList
      items={items}
      loading={loading}
      maxItems={10}
      emptyState="Source field not available from twitterapi.io"
    />
  );
}
