// M13 Phase 4 — Press-alert dispatcher.
// Fires on a new FEED# INSERT in the Feeds table and fans out tone:'press'
// inbox triggers to every watchlist entry opted into that symbol's press
// releases. Inbox-only — no email is sent here.

import type { DynamoDBStreamHandler } from "aws-lambda";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { listWatchersForSymbol } from "@monorepo-template/core/db/watchlist-entries";
import { recordPressTrigger } from "@monorepo-template/core/db/alerts";

export const handler: DynamoDBStreamHandler = async (event) => {
  // Per-invocation cache of symbol → unique watcher userIds, so the same symbol
  // appearing across multiple records in one batch only queries the GSI once.
  // Each FEED item is still a distinct press release, so we emit a trigger per
  // (item × watcher) — only the watcher *lookup* is cached, not the fan-out.
  const watcherCache = new Map<string, string[]>();

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
      const title = img.title?.S;
      const link = img.link?.S;
      const sourceName = img.sourceName?.S;

      // Required fields — skip malformed rows.
      if (!symbol || !kind || !title || !link) continue;

      // Only press releases for now; M14 adds NEWS.
      if (kind !== "PRESS") continue;

      // Resolve (and cache) the deduped set of opted-in watcher userIds.
      let userIds = watcherCache.get(symbol);
      if (!userIds) {
        const entries = await listWatchersForSymbol(symbol);
        userIds = Array.from(new Set(entries.map((e) => e.userId)));
        watcherCache.set(symbol, userIds);
      }

      // Fan out one press trigger per watcher; isolate per-user failures.
      for (const userId of userIds) {
        try {
          await recordPressTrigger({
            userId,
            symbol,
            title,
            link,
            sourceName: sourceName ?? symbol,
          });
        } catch (err) {
          console.error(
            `[feed-alerts] failed to record press trigger for ${userId}/${symbol}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("[feed-alerts] record processing error:", err);
    }
  }
};
