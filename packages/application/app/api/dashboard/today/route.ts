import { requireUserId } from "@/app/_auth/requireUserId";
import { listWatchlistEntries } from "@monorepo-template/core/db/watchlist-entries";
import { getAllTrackedQueries } from "@monorepo-template/core/db/user-data";
import { getSpikingTokens, listTrackedTokens } from "@monorepo-template/core/db/tokens";
import { getPulse, readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { listTriggers } from "@monorepo-template/core/db/alerts";
import type { AlertCondition, AlertTone } from "@monorepo-template/core/db/alerts";
import { bucketRange, hourBucket } from "@monorepo-template/core/db/keys";

// ── Types ──────────────────────────────────────────────────────────────────

export interface TodayKPIs {
  mentions24h: number;
  tokenCount: number;
  netSentiment: number;
  alertCount: number;
}

export interface TodayPulse {
  series: number[];
}

export interface TodaySpike {
  symbol: string;
  deltaScore: number;
  mentions: number;
  sentiment: string;
}

export interface TodayAlert {
  time: string;
  tag: string;
  target: string;
  body: string;
  tone: "buzz" | "sent" | "handle" | "narrative";
}

export interface SentimentToken {
  sym: string;
  mentions: number;
  score: number;
  d: number;
}

export interface SentimentSplit {
  bull: number;
  neu: number;
  bear: number;
}

export interface TodayResponse {
  kpis: TodayKPIs;
  pulse: TodayPulse;
  spikes: TodaySpike[];
  alerts: TodayAlert[];
  watchlistSymbols: string[];
  sentimentGrid: SentimentToken[];
  sentimentSplit: SentimentSplit;
}

// ── Sentiment counts helper ────────────────────────────────────────────────

interface SentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

/**
 * Reads SENTIMENT_BY_QUERY aggregate counts for a symbol within [from, to].
 * Returns zeros on failure.
 */
async function fetchSentimentCounts(sym: string, from: string, to: string): Promise<SentCounts> {
  try {
    const rows = await readAggregateTopK({ type: "SENTIMENT_BY_QUERY", query: sym, from, to, k: 1000 });
    let positive = 0, neutral = 0, negative = 0;
    for (const row of rows) {
      if (row.value === "positive") positive += row.count;
      else if (row.value === "neutral") neutral += row.count;
      else if (row.value === "negative") negative += row.count;
    }
    return { positive, neutral, negative };
  } catch {
    return { positive: 0, neutral: 0, negative: 0 };
  }
}

function sentScore(counts: SentCounts): number {
  const total = counts.positive + counts.neutral + counts.negative;
  return total > 0 ? Math.round(((counts.positive - counts.negative) / total) * 100) : 0;
}

// ── Alert condition/tone → display tag/tone mapping ───────────────────────

/**
 * Maps a trigger's tone + condition to a display tone. Checks `alertTone`
 * first so that press and news triggers (both have `condition === undefined`)
 * are distinguished from each other and from metric triggers.
 */
function conditionToTone(
  condition: AlertCondition | undefined,
  alertTone?: AlertTone,
): "buzz" | "sent" | "handle" | "narrative" {
  // Tone-aware branches (press and news both show as "buzz" in the feed)
  if (alertTone === "news") return "buzz";
  if (alertTone === "press") return "buzz";
  if (condition === "sentiment_swing") return "sent";
  // mention_spike, price_move, and any others → buzz
  return "buzz";
}

/**
 * Maps a trigger's tone + condition to a display tag string. Checks `alertTone`
 * first so that news triggers are tagged "NEWS" rather than "PRESS".
 */
function conditionToTag(
  condition: AlertCondition | undefined,
  alertTone?: AlertTone,
): string {
  // Tone-aware branches
  if (alertTone === "news") return "NEWS";
  if (alertTone === "press") return "PRESS";
  if (condition === "mention_spike") return "BUZZ SPIKE";
  if (condition === "sentiment_swing") return "SENTIMENT FLIP";
  if (condition === undefined) return "PRESS";
  // price_move — only remaining variant
  return "PRICE MOVE";
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Fan out all data fetches in parallel. Each is wrapped in a try/catch so
  // one failing call doesn't collapse the whole response.
  const [watchlistEntries, trackedQueries, spikingTokens, pulseItems, triggers] =
    await Promise.all([
      listWatchlistEntries(userId).catch(() => []),
      getAllTrackedQueries(userId).catch(() => []),
      getSpikingTokens({ window: "1H", limit: 4 }).catch(() => []),
      getPulse("1H").catch(() => []),
      listTriggers(userId, { limit: 20 }).catch(() => []),
    ]);

  // ── tokenCount — unique symbols in watchlist ──────────────────────────
  const watchlistSymbols = watchlistEntries.map((e) => e.symbol);
  const tokenCount = watchlistEntries.length;

  // ── mentions24h + netSentiment — from tracked tokens ────────────────
  let mentions24h = 0;
  let netSentiment = 0;

  if (trackedQueries.length > 0) {
    // Use listTrackedTokens to get global stats (per-user breakdown not available yet).
    const trackedTokens = await listTrackedTokens({ limit: 50 }).catch(() => []);
    if (trackedTokens.length > 0) {
      mentions24h = trackedTokens.reduce((sum, t) => sum + (t.mentions ?? 0), 0);
      let totalSent = 0;
      for (const t of trackedTokens) {
        totalSent += t.sent === "bull" ? 1 : t.sent === "bear" ? -1 : 0;
      }
      netSentiment = Math.round((totalSent / trackedTokens.length) * 100);
    }
  }

  // ── alertCount — triggers from today ────────────────────────────────
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const todayTriggers = triggers.filter(
    (t) => t.createdAt >= todayIso,
  );
  const alertCount = todayTriggers.length;

  // ── pulse series — global per-minute mention counts ─────────────────
  // getPulse returns items in DynamoDB order (newest first when using
  // ScanIndexForward default); we reverse to get ascending (oldest → newest).
  const pulseSorted = [...pulseItems].reverse();
  const pulseSeries = pulseSorted.map((r) => r.count ?? 0);

  // ── spikes ────────────────────────────────────────────────────────────
  const spikes: TodaySpike[] = spikingTokens.map((t) => ({
    symbol: t.sym,
    deltaScore: t.dbuzz ?? 0,
    mentions: t.mentions ?? 0,
    sentiment: t.sent ?? "neu",
  }));

  // ── recent alerts ─────────────────────────────────────────────────────
  const alerts: TodayAlert[] = todayTriggers.slice(0, 8).map((trigger) => ({
    time: new Date(trigger.createdAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }),
    tag: conditionToTag(trigger.condition, trigger.tone),
    target: `$${trigger.symbol}`,
    body: trigger.message,
    tone: conditionToTone(trigger.condition, trigger.tone),
  }));

  // ── sentiment grid — per-symbol fan-out (cap at 12 to bound cost) ─────────
  const sentimentGrid: SentimentToken[] = [];
  const sentimentSplit: SentimentSplit = { bull: 0, neu: 0, bear: 0 };

  if (watchlistSymbols.length > 0) {
    const symsForGrid = watchlistSymbols.slice(0, 12);

    // Current 24h window
    const curBuckets = bucketRange("24H", "hour");
    const curFrom = curBuckets[0];
    const curTo = curBuckets[curBuckets.length - 1];

    // Prior 24h window: the 24h preceding the current window
    const priorToDate = new Date(curFrom);
    const priorFromDate = new Date(priorToDate.getTime() - 24 * 3_600_000);
    // Use hourBucket so the prior-window bounds match the stored sort-key
    // format exactly ("...THH:00:00Z"); a hand-built ".000Z" string would
    // lexically exclude the final hour from the BETWEEN range.
    const priorFrom = hourBucket(priorFromDate);
    const priorTo = hourBucket(new Date(priorToDate.getTime() - 3_600_000));

    const [curCountsArr, priorCountsArr] = await Promise.all([
      Promise.all(symsForGrid.map((sym) => fetchSentimentCounts(sym, curFrom, curTo))),
      Promise.all(symsForGrid.map((sym) => fetchSentimentCounts(sym, priorFrom, priorTo))),
    ]);

    for (let i = 0; i < symsForGrid.length; i++) {
      const sym = symsForGrid[i];
      const cur = curCountsArr[i];
      const prior = priorCountsArr[i];
      const mentions = cur.positive + cur.neutral + cur.negative;
      const score = sentScore(cur);
      const priorScore = sentScore(prior);
      const d = score - priorScore;
      sentimentGrid.push({ sym, mentions, score, d });

      // Accumulate split totals
      sentimentSplit.bull += cur.positive;
      sentimentSplit.neu += cur.neutral;
      sentimentSplit.bear += cur.negative;
    }
  }

  const response: TodayResponse = {
    kpis: { mentions24h, tokenCount, netSentiment, alertCount },
    pulse: { series: pulseSeries },
    spikes,
    alerts,
    watchlistSymbols,
    sentimentGrid,
    sentimentSplit,
  };

  return Response.json(response);
}
