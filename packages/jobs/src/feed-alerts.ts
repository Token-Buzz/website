// M13 Phase 4 / M14 Phase 4 — Press and news alert dispatcher.
// Fires on a new FEED# INSERT in the Feeds table and fans out tone:'press' or
// tone:'news' inbox triggers to every watchlist entry opted into that symbol's
// press releases or news articles respectively. Inbox-only — no email is sent here.

import type { DynamoDBStreamHandler } from "aws-lambda";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import {
  listWatchersForSymbol,
  type WatchlistEntry,
} from "@monorepo-template/core/db/watchlist-entries";
import {
  recordPressTrigger,
  recordNewsTrigger,
} from "@monorepo-template/core/db/alerts";

export const handler: DynamoDBStreamHandler = async (event) => {
  // Per-invocation cache of symbol → full watcher entries (union of press + news
  // opted-in), so the same symbol appearing across multiple records in one batch
  // only queries the GSI once. Each FEED item is still a distinct article, so we
  // emit a trigger per (item × watcher) — only the watcher *lookup* is cached,
  // not the fan-out. The dispatcher filters entries per-kind before deduping.
  const watcherCache = new Map<string, WatchlistEntry[]>();

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

      // Only press releases and news articles; skip all other kinds.
      if (kind !== "PRESS" && kind !== "NEWS") continue;

      // Resolve (and cache) the full set of opted-in watcher entries for this
      // symbol (union of pressAlerts and newsAlerts). Filter per-kind below.
      let allEntries = watcherCache.get(symbol);
      if (!allEntries) {
        allEntries = await listWatchersForSymbol(symbol);
        watcherCache.set(symbol, allEntries);
      }

      // Filter entries to those opted into this specific kind, then dedupe userIds.
      const kindEntries =
        kind === "PRESS"
          ? allEntries.filter((e) => e.pressAlerts === true)
          : allEntries.filter((e) => e.newsAlerts === true);
      const userIds = Array.from(new Set(kindEntries.map((e) => e.userId)));

      // Fan out one trigger per watcher; isolate per-user failures.
      for (const userId of userIds) {
        try {
          if (kind === "PRESS") {
            await recordPressTrigger({
              userId,
              symbol,
              title,
              link,
              sourceName: sourceName ?? symbol,
            });
          } else {
            await recordNewsTrigger({
              userId,
              symbol,
              title,
              link,
              sourceName: sourceName ?? symbol,
            });
          }
        } catch (err) {
          console.error(
            `[feed-alerts] failed to record ${kind} trigger for ${userId}/${symbol}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("[feed-alerts] record processing error:", err);
    }
  }
};
