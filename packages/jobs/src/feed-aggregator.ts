// M14 Phase 5 — Feed aggregator.
// On a new FEED# INSERT, increments the per-symbol per-day NEWS_VOLUME counter
// for both PRESS and NEWS kinds on the Aggregates table, and additionally rolls
// up the top news outlet (sourceName) per symbol per hour for NEWS items via
// incrementNewsSource. Mirrors the aggregator → Aggregates fan-out pattern.

import type { DynamoDBStreamHandler } from "aws-lambda";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { incrementNewsVolume, incrementNewsSource } from "@monorepo-template/core/db/aggregates";
import { hourBucket } from "@monorepo-template/core/db/keys";

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    try {
      // Only new feed items matter; ignore MODIFY/REMOVE.
      if (record.eventName !== "INSERT") continue;

      const img = record.dynamodb?.NewImage as
        | Record<string, AttributeValue>
        | undefined;
      if (!img) continue;

      // Only feed-item rows (pk = FEED#<SYM>#<KIND>). This correctly excludes
      // poll-cursor rows (pk = FEEDSRC#<SYM>#<KIND>), which start with FEEDSRC#.
      const pk = img.pk?.S;
      if (!pk?.startsWith("FEED#")) continue;

      const symbol = img.symbol?.S;
      const kind = img.kind?.S;
      const publishedAt = img.publishedAt?.S;

      // Required fields — skip malformed rows.
      if (!symbol || !kind || !publishedAt) continue;

      // Only PRESS and NEWS feed items; reject other kinds.
      if (kind !== "PRESS" && kind !== "NEWS") continue;

      // Derive the UTC day bucket (YYYY-MM-DD); guard against invalid dates.
      const published = new Date(publishedAt);
      if (isNaN(published.getTime())) continue;
      const dayBucket = published.toISOString().slice(0, 10);

      await incrementNewsVolume(symbol, kind, dayBucket);

      // For NEWS items, also roll up the top outlet counter per hour bucket.
      if (kind === "NEWS") {
        const sourceName = img.sourceName?.S;
        if (sourceName) {
          const hb = hourBucket(published);
          await incrementNewsSource(symbol, sourceName, hb);
        }
      }
    } catch (err) {
      console.error("[feed-aggregator] record processing error:", err);
    }
  }
};
