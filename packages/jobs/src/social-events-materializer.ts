import type { Handler } from "aws-lambda";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";
import {
  readPulseSeries,
  getSentiment,
} from "@monorepo-template/core/db/aggregates";
import {
  detectVolumeSpikes,
  detectSentimentSpikes,
  volumeSpikeEvent,
  sentimentSpikeEvent,
  type SpikePoint,
  type SentimentPoint,
} from "@monorepo-template/core/social-events";
import { writeSocialEvent } from "@monorepo-template/core/db/social-events";

const DEFAULT_SYMBOLS = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];

export const handler: Handler = async () => {
  let symbols: string[];
  try {
    const tracked = await listTrackedTokens();
    symbols = tracked.length ? tracked.map((t) => t.sym) : DEFAULT_SYMBOLS;
  } catch {
    symbols = DEFAULT_SYMBOLS;
  }

  const now = Date.now();

  // Minute bounds for trailing 180 minutes — use slice(0,16) to match the
  // exact key format written by the aggregator (no seconds, no Z suffix).
  const fromMinute = new Date(now - 179 * 60_000).toISOString().slice(0, 16);
  const toMinute = new Date(now).toISOString().slice(0, 16);

  for (const symbol of symbols) {
    try {
      // ── Volume spikes ─────────────────────────────────────────────────────
      const series = await readPulseSeries(symbol, fromMinute, toMinute);

      // Re-append ":00Z" so the no-Z bucket string parses as UTC midnight of
      // that minute, e.g. "2026-05-27T15:43" → "2026-05-27T15:43:00Z".
      const volumePoints: SpikePoint[] = series.map((s) => ({
        ts: Math.floor(new Date(s.bucket + ":00Z").getTime() / 1000),
        value: s.count,
      }));

      const volumeSpikes = detectVolumeSpikes(volumePoints);
      for (const s of volumeSpikes) {
        await writeSocialEvent(volumeSpikeEvent(symbol, s));
      }
    } catch (err) {
      console.error(`[social-events-materializer] volume spike failed for ${symbol}:`, err);
    }

    try {
      // ── Sentiment spikes ──────────────────────────────────────────────────
      const recs = await getSentiment(symbol, "7D");

      const sentimentPoints: SentimentPoint[] = recs.map((r) => ({
        ts: Math.floor(new Date((r as any).bucket).getTime() / 1000),
        bull: (r as any).bullCount ?? (r as any).bull ?? 0,
        bear: (r as any).bearCount ?? (r as any).bear ?? 0,
        neu: (r as any).neutralCount ?? (r as any).neu ?? 0,
      }));

      const sentimentSpikes = detectSentimentSpikes(sentimentPoints);
      for (const s of sentimentSpikes) {
        await writeSocialEvent(sentimentSpikeEvent(symbol, s));
      }
    } catch (err) {
      console.error(`[social-events-materializer] sentiment spike failed for ${symbol}:`, err);
    }
  }
};
