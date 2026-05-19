import type { Handler } from "aws-lambda";
import {
  listTrackedTokens,
  writeSpike,
} from "@monorepo-template/core/db/tokens";
import { getPulse } from "@monorepo-template/core/db/aggregates";

export const handler: Handler = async () => {
  let tokens: string[];
  try {
    const trackedTokens = await listTrackedTokens();
    tokens = trackedTokens.map((t) => t.sym);
  } catch {
    tokens = ["$PEPE", "$SOL", "$MOG", "$WIF", "$BONK", "$DOGE"];
  }

  const now = new Date();
  const computedAt = now.toISOString();

  for (const symbol of tokens) {
    try {
      // Get last 10 minutes of pulse data
      const pulse = await getPulse("1H");
      if (pulse.length < 2) continue;

      // Current window: most recent 5 min; prior window: prior 5 min
      const current = pulse.slice(0, 5).reduce((s: any, p: any) => s + (p.count || 0), 0);
      const prior = pulse.slice(5, 10).reduce((s: any, p: any) => s + (p.count || 0), 0);

      const deltaScore =
        prior > 0
          ? Math.round(((current - prior) / prior) * 100)
          : current > 0
            ? 9999
            : 0;

      await writeSpike({
        symbol,
        deltaScore,
        currentMentions: current,
        priorMentions: prior,
        computedAt,
      });
    } catch (err) {
      console.error(`Spike materializer failed for ${symbol}:`, err);
    }
  }
};
