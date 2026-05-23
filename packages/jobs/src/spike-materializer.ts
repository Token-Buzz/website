import type { Handler } from "aws-lambda";
import {
  listTrackedTokens,
  updateTokenBuzz,
} from "@monorepo-template/core/db/tokens";
import { sumPulse } from "@monorepo-template/core/db/aggregates";
import { minuteBucket } from "@monorepo-template/core/db/keys";
import { computeBuzzDelta } from "@monorepo-template/core/movers";

const DEFAULT_SYMBOLS = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
const MINUTE = 60_000;

export const handler: Handler = async () => {
  let symbols: string[];
  try {
    const tracked = await listTrackedTokens();
    symbols = tracked.length ? tracked.map((t) => t.sym) : DEFAULT_SYMBOLS;
  } catch {
    symbols = DEFAULT_SYMBOLS;
  }

  const now = Date.now();
  // Current hour: the last 60 minute-buckets. Prior hour: the 60 before that.
  // Windows are disjoint so the boundary minute is not double-counted.
  const curFrom = minuteBucket(now - 59 * MINUTE);
  const curTo = minuteBucket(now);
  const priorFrom = minuteBucket(now - 119 * MINUTE);
  const priorTo = minuteBucket(now - 60 * MINUTE);

  for (const symbol of symbols) {
    try {
      const [current, prior] = await Promise.all([
        sumPulse(symbol, curFrom, curTo),
        sumPulse(symbol, priorFrom, priorTo),
      ]);

      const dbuzz = computeBuzzDelta(current, prior);

      await updateTokenBuzz({ symbol, dbuzz, mentions: current });
    } catch (err) {
      console.error(`Spike materializer failed for ${symbol}:`, err);
    }
  }
};
