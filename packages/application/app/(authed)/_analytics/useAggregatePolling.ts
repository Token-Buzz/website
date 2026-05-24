"use client";

import { useState, useEffect } from "react";
import { createGate } from "./concurrencyGate";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000, 8_000, 8_000];

// One shared gate across all chart instances on the page.
// Caps concurrent in-flight fetches to prevent Lambda concurrency throttling
// when ~20 charts mount simultaneously and all fire fetch() at once.
const MAX_CONCURRENT_FETCHES = 5;
const fetchGate = createGate(MAX_CONCURRENT_FETCHES);

// ── useObjectPolling ───────────────────────────────────────────────────────
// Like useAggregatePolling but for endpoints that return a single JSON object
// rather than an array. Polls until a non-null result is returned or deadline.

export function useObjectPolling<T extends object>(
  url: string | null,
  opts?: {
    timeoutMs?: number;
    schedule?: number[];
    isPopulated?: (data: T) => boolean;
  },
): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const schedule = opts?.schedule ?? DEFAULT_SCHEDULE_MS;
    const isPopulated = opts?.isPopulated ?? (() => true);
    const deadline = Date.now() + timeoutMs;

    setLoading(true);
    setError(null);
    setData(null);

    let attemptIndex = 0;
    let lastSeen: T | null = null;

    async function poll(): Promise<void> {
      if (cancelled) return;

      try {
        // Gate is released as soon as the fetch settles (try/finally inside run).
        // The backoff sleep happens outside the gate so retrying requests don't
        // hold a slot while waiting — they re-acquire on the next attempt.
        const res = await fetchGate.run(() => fetch(url!));
        if (cancelled) return;

        if (!res.ok) {
          // 429 (Lambda concurrency throttle) and 5xx are transient — retry on the
          // backoff schedule rather than surfacing a hard error.
          if (res.status !== 429 && res.status < 500) {
            setError(String(res.status));
            setLoading(false);
            return;
          }
        } else {
          const json = (await res.json()) as T;
          if (cancelled) return;

          if (json && typeof json === "object" && !Array.isArray(json)) {
            lastSeen = json;
            if (isPopulated(json)) {
              setData(json);
              setLoading(false);
              return;
            }
          }
        }
      } catch {
        // swallow network errors; retry on schedule
      }

      if (cancelled) return;

      if (Date.now() >= deadline) {
        if (lastSeen) setData(lastSeen);
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
        if (lastSeen) setData(lastSeen);
        setLoading(false);
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { data, loading, error };
}

// ── useAggregatePolling ────────────────────────────────────────────────────

export function useAggregatePolling<T>(
  url: string | null,
  opts?: { timeoutMs?: number; schedule?: number[] },
): { items: T[]; loading: boolean; error: string | null } {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
        // Gate is released as soon as the fetch settles (try/finally inside run).
        // The backoff sleep happens outside the gate so retrying requests don't
        // hold a slot while waiting — they re-acquire on the next attempt.
        const res = await fetchGate.run(() => fetch(url!));
        if (cancelled) return;

        if (!res.ok) {
          // 429 (Lambda concurrency throttle) and 5xx are transient — retry on the
          // backoff schedule rather than surfacing a hard error.
          if (res.status !== 429 && res.status < 500) {
            setError(String(res.status));
            setLoading(false);
            return;
          }
        } else {
          const data = (await res.json()) as T[];
          if (cancelled) return;

          if (Array.isArray(data) && data.length > 0) {
            setItems(data);
            setLoading(false);
            return;
          }
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
