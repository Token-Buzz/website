import type { Handler } from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { listTrackedTokens } from "@monorepo-template/core/db/tokens";
import { sumPulse } from "@monorepo-template/core/db/aggregates";
import { getOHLCV } from "@monorepo-template/core/db/ohlcv";
import { computeBuzzDelta, windowMinuteRange } from "@monorepo-template/core/movers";
import { INTERVAL_SECONDS } from "@monorepo-template/core/providers/price";
import {
  derivePriceFromBars,
  type TickerSnapshot,
  type TickerToken,
} from "@monorepo-template/core/ticker";

const TOP_N = 9;
const OBJECT_KEY = "static/ticker.json";
const s3 = new S3Client({});

export const handler: Handler = async () => {
  const bucket = process.env.TICKER_BUCKET;
  if (!bucket) throw new Error("TICKER_BUCKET env var is not set");

  const tracked = await listTrackedTokens({ limit: TOP_N });
  const now = Date.now();
  const toSec = Math.floor(now / 1000);
  const fromSec = toSec - 25 * INTERVAL_SECONDS["1h"];
  const range = windowMinuteRange("1H", now);

  const tokens: TickerToken[] = await Promise.all(
    tracked.map(async (t): Promise<TickerToken> => {
      const sym = t.sym;
      const [cur, prior, ohlcv] = await Promise.all([
        sumPulse(sym, range.curFrom, range.curTo),
        sumPulse(sym, range.priorFrom, range.priorTo),
        getOHLCV(sym, "1h", fromSec, toSec),
      ]);
      const { price, deltaPct } = derivePriceFromBars(ohlcv.bars);
      return {
        symbol: sym,
        price,
        deltaPct,
        buzzDelta: computeBuzzDelta(cur, prior) / 100,
      };
    }),
  );

  const snapshot: TickerSnapshot = {
    updatedAt: new Date().toISOString(),
    tokens,
  };

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: OBJECT_KEY,
      Body: JSON.stringify(snapshot),
      ContentType: "application/json",
      CacheControl: "max-age=30, s-maxage=30",
    }),
  );

  console.log(
    `TickerSnapshot: wrote ${tokens.length} tokens to s3://${bucket}/${OBJECT_KEY}`,
  );
};
