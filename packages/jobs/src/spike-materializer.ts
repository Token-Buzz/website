import type { Handler } from "aws-lambda";
import {
  listTrackedTokens,
  updateTokenBuzz,
} from "@monorepo-template/core/db/tokens";
import { sumPulse } from "@monorepo-template/core/db/aggregates";
import {
  computeBuzzDelta,
  windowMinuteRange,
  type MoverWindow,
} from "@monorepo-template/core/movers";

// NOTE: The 24H and 7D windows sum 1440 and 10080 minute-buckets respectively.
// Read cost scales with window length × tracked token count — acceptable for
// v1's small token set. A future optimisation could use hourly rollups to
// reduce the number of DynamoDB reads for the longer windows.

const DEFAULT_SYMBOLS = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
const WINDOWS: MoverWindow[] = ["1H", "24H", "7D"];

export const handler: Handler = async () => {
  let symbols: string[];
  try {
    const tracked = await listTrackedTokens();
    symbols = tracked.length ? tracked.map((t) => t.sym) : DEFAULT_SYMBOLS;
  } catch {
    symbols = DEFAULT_SYMBOLS;
  }

  const now = Date.now();

  for (const symbol of symbols) {
    try {
      // Compute buzz delta for all three time windows in parallel.
      const windowResults = await Promise.all(
        WINDOWS.map(async (w) => {
          const range = windowMinuteRange(w, now);
          const [current, prior] = await Promise.all([
            sumPulse(symbol, range.curFrom, range.curTo),
            sumPulse(symbol, range.priorFrom, range.priorTo),
          ]);
          return { window: w, current, prior, delta: computeBuzzDelta(current, prior) };
        }),
      );

      const byWindow = Object.fromEntries(
        windowResults.map(({ window: w, delta }) => [w, delta]),
      ) as Record<MoverWindow, number>;

      // mentions = current 1H volume (unchanged from original behaviour).
      const mentions1h = windowResults.find((r) => r.window === "1H")!.current;

      await updateTokenBuzz({
        symbol,
        mentions: mentions1h,
        deltas: byWindow,
      });
    } catch (err) {
      console.error(`Spike materializer failed for ${symbol}:`, err);
    }
  }
};
