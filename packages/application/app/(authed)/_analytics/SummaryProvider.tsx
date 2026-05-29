"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

// ── Types matching the summary route response shape ────────────────────────

export interface SummaryData {
  hashtags: { hashtag: string; count: number }[] | null;
  mentions: { mention: string; count: number }[] | null;
  domains: { domain: string; count: number }[] | null;
  bioDomains: { domain: string; count: number }[] | null;
  languages: { language: string; count: number }[] | null;
  sourceDistribution: { source: string; count: number }[] | null;
  symbolRate: { rate: number; sparkline: number[] } | null;
  engagementTimeseries:
    | { bucket: string; likes: number; retweets: number; replies: number; quotes: number }[]
    | null;
  sentimentAggregation: {
    positive: number;
    neutral: number;
    negative: number;
    averageScore: number;
  } | null;
  sentimentByQuery:
    | { bucket: string; positive: number; neutral: number; negative: number }[]
    | null;
  keywords: { keyword: string; count: number }[] | null;
  conversationThreads: { threads: { depth: string; count: number }[]; truncated: boolean } | null;
  geographic: { countries: { country: string; count: number }[]; truncated: boolean } | null;
  verificationBreakdown: {
    blue: number;
    business: number;
    government: number;
    unverified: number;
  } | null;
  botRatio: {
    automated: number;
    notAutomated: number;
    automatedPercentage: number;
    methodology: string;
  } | null;
  postingHeatmap: { day: string; hour: number; count: number }[] | null;
  contentLengthEngagement: {
    points: { length: number; engagement: number }[];
    truncated: boolean;
  } | null;
  authorInfluence: { low: number; mid: number; high: number } | null;
  tweets: {
    tweets: {
      tweetId: string;
      query: string;
      text: string;
      authorUsername: string;
      authorName: string;
      authorFollowers: number;
      createdAt: string;
      likeCount: number;
      retweetCount: number;
      source: string;
    }[];
    query: string;
  } | null;
  sourceCounts: Record<string, number> | null;
}

interface SummaryState {
  data: SummaryData | null;
  loading: boolean;
  error: string | null;
}

interface SummaryContextValue extends SummaryState {
  query: string;
}

const SummaryContext = createContext<SummaryContextValue>({
  query: "",
  data: null,
  loading: false,
  error: null,
});

// ── Retry config (mirrors useAggregatePolling) ─────────────────────────────

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_SCHEDULE_MS = [1_000, 2_000, 4_000, 8_000, 8_000, 8_000];

// ── Provider ───────────────────────────────────────────────────────────────

export function SummaryProvider({
  query,
  children,
}: {
  query: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<SummaryState>({
    data: null,
    loading: false,
    error: null,
  });

  // Track whether we have any non-null populated key in the summary.
  // The summary request completes once any sub-query returns real data.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ data: null, loading: false, error: null });
      return;
    }

    cancelledRef.current = false;
    const deadline = Date.now() + DEFAULT_TIMEOUT_MS;
    let attemptIndex = 0;

    setState({ data: null, loading: true, error: null });

    let lastData: SummaryData | null = null;

    async function poll(): Promise<void> {
      if (cancelledRef.current) return;

      const url = `/api/analytics/summary?query=${encodeURIComponent(query)}`;

      try {
        const res = await fetch(url);

        if (cancelledRef.current) return;

        if (!res.ok) {
          // 429 / 5xx — transient, retry
          if (res.status !== 429 && res.status < 500) {
            setState({ data: lastData, loading: false, error: String(res.status) });
            return;
          }
        } else {
          const json = (await res.json()) as SummaryData;

          if (cancelledRef.current) return;

          lastData = json;

          // Consider the payload "populated" once at least one array key is
          // non-empty or at least one object key is non-null.
          // This means the server reached DynamoDB and returned something real.
          const populated = isPopulated(json);

          setState({ data: json, loading: !populated, error: null });

          if (populated) return;
        }
      } catch {
        // network error — retry
      }

      if (cancelledRef.current) return;

      if (Date.now() >= deadline) {
        setState({ data: lastData, loading: false, error: null });
        return;
      }

      const delay = DEFAULT_SCHEDULE_MS[attemptIndex] ?? 8_000;
      attemptIndex++;

      await new Promise<void>((resolve) => setTimeout(resolve, delay));

      if (cancelledRef.current) return;

      if (Date.now() < deadline) {
        void poll();
      } else {
        setState({ data: lastData, loading: false, error: null });
      }
    }

    void poll();

    return () => {
      cancelledRef.current = true;
    };
  }, [query]);

  return (
    <SummaryContext.Provider value={{ query, ...state }}>
      {children}
    </SummaryContext.Provider>
  );
}

// ── StaticSummaryProvider ──────────────────────────────────────────────────

/**
 * Supplies pre-fetched snapshot data into `SummaryContext` without any
 * network polling. Charts read context exactly as they do under the live
 * `SummaryProvider`. Pass `data: null` to show all charts in their empty /
 * loading-skeleton state.
 */
export function StaticSummaryProvider({
  query,
  data,
  children,
}: {
  query: string;
  data: SummaryData | null;
  children: ReactNode;
}) {
  return (
    <SummaryContext.Provider value={{ query, data, loading: false, error: null }}>
      {children}
    </SummaryContext.Provider>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function isPopulated(data: SummaryData): boolean {
  return (
    (data.hashtags !== null && data.hashtags.length > 0) ||
    (data.mentions !== null && data.mentions.length > 0) ||
    (data.domains !== null && data.domains.length > 0) ||
    (data.bioDomains !== null && data.bioDomains.length > 0) ||
    (data.languages !== null && data.languages.length > 0) ||
    (data.engagementTimeseries !== null && data.engagementTimeseries.length > 0) ||
    (data.keywords !== null && data.keywords.length > 0) ||
    (data.postingHeatmap !== null && data.postingHeatmap.length > 0) ||
    (data.symbolRate !== null && (data.symbolRate.rate > 0 || data.symbolRate.sparkline.some((n) => n > 0))) ||
    (data.sentimentAggregation !== null &&
      data.sentimentAggregation.positive + data.sentimentAggregation.neutral + data.sentimentAggregation.negative > 0) ||
    (data.sentimentByQuery !== null && data.sentimentByQuery.length > 0) ||
    (data.conversationThreads !== null && data.conversationThreads.threads.length > 0) ||
    (data.geographic !== null && data.geographic.countries.length > 0) ||
    (data.verificationBreakdown !== null &&
      data.verificationBreakdown.blue + data.verificationBreakdown.business +
      data.verificationBreakdown.government + data.verificationBreakdown.unverified > 0) ||
    (data.botRatio !== null && data.botRatio.automated + data.botRatio.notAutomated > 0) ||
    (data.contentLengthEngagement !== null && data.contentLengthEngagement.points.length > 0) ||
    (data.authorInfluence !== null &&
      data.authorInfluence.low + data.authorInfluence.mid + data.authorInfluence.high > 0) ||
    (data.tweets !== null && data.tweets.tweets.length > 0)
  );
}

// ── Consumer hooks ─────────────────────────────────────────────────────────

export function useSummaryContext(): SummaryContextValue {
  return useContext(SummaryContext);
}

/**
 * Returns an array field from the summary payload.
 * Mirrors the `{ items, loading, error }` shape of useAggregatePolling.
 */
export function useSummaryItems<K extends ArraySummaryKey>(
  key: K,
): { items: NonNullable<SummaryData[K]>; loading: boolean; error: string | null } {
  const { data, loading, error } = useContext(SummaryContext);
  const raw = data?.[key] ?? null;
  const items = (Array.isArray(raw) ? raw : []) as NonNullable<SummaryData[K]>;
  return { items, loading, error };
}

/**
 * Returns an object field from the summary payload.
 * Mirrors the `{ data, loading, error }` shape of useObjectPolling.
 */
export function useSummaryField<K extends ObjectSummaryKey>(
  key: K,
): { data: SummaryData[K]; loading: boolean; error: string | null } {
  const { data, loading, error } = useContext(SummaryContext);
  return { data: data?.[key] ?? null, loading, error };
}

// ── Type helpers ───────────────────────────────────────────────────────────

// Keys whose value is an array (use useSummaryItems)
type ArraySummaryKey = {
  [K in keyof SummaryData]: NonNullable<SummaryData[K]> extends unknown[] ? K : never;
}[keyof SummaryData];

// Keys whose value is an object (use useSummaryField)
type ObjectSummaryKey = {
  [K in keyof SummaryData]: NonNullable<SummaryData[K]> extends unknown[] ? never : K;
}[keyof SummaryData];
