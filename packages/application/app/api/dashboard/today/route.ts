import { auth } from "@clerk/nextjs/server";
import { listWatchlistEntries } from "@monorepo-template/core/db/watchlist-entries";
import { getAllTrackedQueries } from "@monorepo-template/core/db/user-data";
import { getSpikingTokens, listTrackedTokens } from "@monorepo-template/core/db/tokens";
import { getPulse } from "@monorepo-template/core/db/aggregates";
import { listTriggers } from "@monorepo-template/core/db/alerts";
import type { AlertCondition } from "@monorepo-template/core/db/alerts";

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

export interface TodayResponse {
  kpis: TodayKPIs;
  pulse: TodayPulse;
  spikes: TodaySpike[];
  alerts: TodayAlert[];
  watchlistSymbols: string[];
}

// ── Alert condition → tone mapping ─────────────────────────────────────────

function conditionToTone(condition: AlertCondition): "buzz" | "sent" | "handle" | "narrative" {
  if (condition === "sentiment_swing") return "sent";
  // mention_spike, price_move, and any others → buzz
  return "buzz";
}

function conditionToTag(condition: AlertCondition): string {
  if (condition === "mention_spike") return "BUZZ SPIKE";
  if (condition === "sentiment_swing") return "SENTIMENT FLIP";
  // price_move — only remaining variant
  return "PRICE MOVE";
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
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
    tag: conditionToTag(trigger.condition),
    target: `$${trigger.symbol}`,
    body: trigger.message,
    tone: conditionToTone(trigger.condition),
  }));

  const response: TodayResponse = {
    kpis: { mentions24h, tokenCount, netSentiment, alertCount },
    pulse: { series: pulseSeries },
    spikes,
    alerts,
    watchlistSymbols,
  };

  return Response.json(response);
}
