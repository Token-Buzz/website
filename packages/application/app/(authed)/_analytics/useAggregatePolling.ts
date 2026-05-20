"use client";

import { useState, useEffect } from "react";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000, 8_000, 8_000];

export function useAggregatePolling<T>(
  url: string | null,
  opts?: { timeoutMs?: number; schedule?: number[] },
): { items: T[]; loading: boolean; error: string | null } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setItems([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const schedule = opts?.schedule ?? DEFAULT_SCHEDULE_MS;
    const deadline = Date.now() + timeoutMs;

    setLoading(true);
    setError(null);
    setItems([]);

    let attemptIndex = 0;

    async function poll(): Promise<void> {
      if (cancelled) return;

      try {
        const res = await fetch(url!);
        if (cancelled) return;

        if (!res.ok) {
          setError(String(res.status));
          setLoading(false);
          return;
        }

        const data = (await res.json()) as T[];
        if (cancelled) return;

        if (Array.isArray(data) && data.length > 0) {
          setItems(data);
          setLoading(false);
          return;
        }
      } catch {
        // swallow network errors; retry on schedule
      }

      if (cancelled) return;

      if (Date.now() >= deadline) {
        // Deadline expired — give up
        setLoading(false);
        return;
      }

      const delay = schedule[attemptIndex] ?? 8_000;
      attemptIndex++;

      await new Promise<void>((resolve) => setTimeout(resolve, delay));

      if (cancelled) return;

      if (Date.now() < deadline) {
        void poll();
      } else {
        setLoading(false);
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
    // opts is intentionally excluded — callers should pass stable refs or literals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { items, loading, error };
}
