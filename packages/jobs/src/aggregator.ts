// DynamoDB Streams delivers at-least-once. Duplicate INSERTs (rare, <1%
// real-world rate) will cause slight counter inflation. Per v1 spec this
// is accepted; exact counts are not required.

import type { DynamoDBStreamHandler } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import { ddb } from "@monorepo-template/core/db/client";
import {
  incrementPulse,
  incrementHourlyHashtags,
  incrementHourlyMentions,
  incrementHourlyDomains,
} from "@monorepo-template/core/db/aggregates";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extracts URL domain from a URL string, stripping leading www. */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Formats an ISO hour bucket from a Date: "2026-05-17T14:00:00.000Z" */
function toHourBucket(d: Date): string {
  return d.toISOString().slice(0, 13) + ":00:00.000Z";
}

/** Returns the day-of-week abbreviation + zero-padded hour, e.g. "Mon-14" */
function toHeatmapBucket(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = days[d.getUTCDay()];
  const hour = d.getUTCHours().toString().padStart(2, "0");
  return `${day}-${hour}`;
}

/** Standard counter increment for a single Aggregates row. */
async function incrementCounter(
  pk: string,
  sk: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Aggregates.name,
      Key: { pk, sk },
      UpdateExpression: "ADD #c :one",
      ExpressionAttributeNames: { "#c": "count" },
      ExpressionAttributeValues: { ":one": 1 },
    }),
  );
}

// ── Per-type fan-out helpers ──────────────────────────────────────────────────

async function aggregateHashtags(
  hashtags: string[],
  query: string,
  hourBucket: string,
): Promise<void> {
  for (const tag of hashtags) {
    await incrementCounter(`AGG#HASHTAG#${query}`, `BUCKET#${hourBucket}#${tag}`);
  }
}

async function aggregateMentions(
  mentions: string[],
  query: string,
  hourBucket: string,
): Promise<void> {
  for (const user of mentions) {
    await incrementCounter(`AGG#MENTION#${query}`, `BUCKET#${hourBucket}#${user}`);
  }
}

async function aggregateDomains(
  urls: string[],
  query: string,
  hourBucket: string,
): Promise<void> {
  const uniqueDomains = Array.from(
    new Set(urls.map(extractDomain).filter((d): d is string => d !== null)),
  );
  for (const domain of uniqueDomains) {
    await incrementCounter(`AGG#DOMAIN#${query}`, `BUCKET#${hourBucket}#${domain}`);
  }
}

async function aggregateBioDomains(
  bioUrls: string[],
  query: string,
  hourBucket: string,
): Promise<void> {
  // Called once per unique author per batch (deduped in handler).
  const uniqueDomains = Array.from(
    new Set(bioUrls.map(extractDomain).filter((d): d is string => d !== null)),
  );
  for (const domain of uniqueDomains) {
    await incrementCounter(`AGG#BIO_DOMAIN#${query}`, `BUCKET#${hourBucket}#${domain}`);
  }
}

async function aggregateLang(
  lang: string | undefined,
  query: string,
  hourBucket: string,
): Promise<void> {
  if (!lang) return;
  await incrementCounter(`AGG#LANG#${query}`, `BUCKET#${hourBucket}#${lang}`);
}

// TODO Phase X: needs `source` field — twitterapi.io does not return it yet.
// async function aggregateSource(...) { ... }

async function aggregateVerification(
  isBlueVerified: boolean | undefined,
  verifiedType: string | undefined,
  query: string,
  hourBucket: string,
): Promise<void> {
  // Called once per unique author per batch (deduped in handler).
  let label: string;
  if (verifiedType === "business") {
    label = "business";
  } else if (verifiedType === "government") {
    label = "government";
  } else if (isBlueVerified === true) {
    label = "blue";
  } else {
    label = "none";
  }
  await incrementCounter(`AGG#VERIFICATION#${query}`, `BUCKET#${hourBucket}#${label}`);
}

async function aggregateBot(
  isAutomated: boolean | undefined,
  botScore: number | undefined,
  query: string,
  hourBucket: string,
): Promise<void> {
  // Called once per unique author per batch (deduped in handler).
  const label =
    isAutomated === true || (botScore !== undefined && botScore >= 0.5)
      ? "automated"
      : "human";
  await incrementCounter(`AGG#BOT#${query}`, `BUCKET#${hourBucket}#${label}`);
}

async function aggregateHeatmap(
  createdAt: Date,
  query: string,
  hourBucket: string,
): Promise<void> {
  const value = toHeatmapBucket(createdAt);
  await incrementCounter(`AGG#HEATMAP#${query}`, `BUCKET#${hourBucket}#${value}`);
}

async function aggregateKeywords(
  keywords: string[],
  query: string,
  hourBucket: string,
): Promise<void> {
  for (const kw of keywords) {
    await incrementCounter(`AGG#KEYWORD#${query}`, `BUCKET#${hourBucket}#${kw}`);
  }
}

async function aggregateAuthorInfluence(
  followers: number | undefined,
  query: string,
  hourBucket: string,
): Promise<void> {
  // Called once per unique author per batch (deduped in handler).
  let label: string;
  if (followers === undefined || followers < 1000) {
    label = "low";
  } else if (followers <= 100_000) {
    label = "mid";
  } else {
    label = "high";
  }
  await incrementCounter(`AGG#AUTHOR_INFLUENCE#${query}`, `BUCKET#${hourBucket}#${label}`);
}

async function aggregateEngagement(
  likes: number,
  retweets: number,
  replies: number,
  quotes: number,
  query: string,
  hourBucket: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Aggregates.name,
      Key: {
        pk: `AGG#ENGAGEMENT#${query}`,
        sk: `BUCKET#${hourBucket}#engagement`,
      },
      UpdateExpression: "ADD likes :l, retweets :r, replies :rp, quotes :q",
      ExpressionAttributeValues: {
        ":l": likes,
        ":r": retweets,
        ":rp": replies,
        ":q": quotes,
      },
    }),
  );
}

async function aggregateSentimentByQuery(
  sentiment: string | undefined,
  query: string,
  hourBucket: string,
): Promise<void> {
  // Sentiment is written async by sentiment.ts; on INSERT it will be undefined.
  // Skip if not yet populated.
  if (!sentiment) return;
  // Map internal bull/bear/neu labels to the positive/neutral/negative labels.
  let label: string;
  if (sentiment === "bull" || sentiment === "positive") {
    label = "positive";
  } else if (sentiment === "bear" || sentiment === "negative") {
    label = "negative";
  } else {
    label = "neutral";
  }
  await incrementCounter(`AGG#SENTIMENT_BY_QUERY#${query}`, `BUCKET#${hourBucket}#${label}`);
}

// ── Main handler ─────────────────────────────────────────────────────────────

export const handler: DynamoDBStreamHandler = async (event) => {
  // Per-batch author dedupe sets (keyed by "query|authorUsername").
  // Prevents 30 tweets from one author triple-counting author-level aggregates
  // (BIO_DOMAIN, VERIFICATION, BOT, AUTHOR_INFLUENCE) in the same batch.
  const seenAuthors = new Set<string>();

  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    const img = record.dynamodb?.NewImage;
    if (!img) continue;

    const query = img.query?.S;
    const createdAt = img.createdAt?.S;
    if (!query || !createdAt) continue;

    const ts = new Date(createdAt);
    const minuteBucket = ts.toISOString().slice(0, 16); // "2025-05-16T09:14"
    const hourBucket = toHourBucket(ts);                // "2025-05-16T09:00:00.000Z"

    // ── Fields shared by multiple aggregate types ─────────────────────────
    const hashtags =
      img.hashtags?.L?.map((h: { S?: string }) => h.S).filter((s): s is string => !!s) ?? [];
    const mentions =
      img.mentions?.L?.map((m: { S?: string }) => m.S).filter((s): s is string => !!s) ?? [];
    const urls =
      img.urls?.L?.map((u: { S?: string }) => u.S).filter((s): s is string => !!s) ?? [];
    const lang = img.lang?.S;
    const authorUsername = img.authorUsername?.S ?? "";
    const authorBioUrls =
      img.authorBioUrls?.L?.map((u: { S?: string }) => u.S).filter((s): s is string => !!s) ?? [];
    const authorIsBlueVerified = img.authorIsBlueVerified?.BOOL;
    const authorVerifiedType = img.authorVerifiedType?.S;
    const authorIsAutomated = img.authorIsAutomated?.BOOL;
    const botScore =
      img.botScore?.N !== undefined ? Number(img.botScore.N) : undefined;
    const authorFollowers =
      img.authorFollowers?.N !== undefined ? Number(img.authorFollowers.N) : undefined;
    const keywords =
      img.keywords?.L?.map((k: { S?: string }) => k.S).filter((s): s is string => !!s) ?? [];
    const likeCount =
      img.likeCount?.N !== undefined ? Number(img.likeCount.N) : 0;
    const retweetCount =
      img.retweetCount?.N !== undefined ? Number(img.retweetCount.N) : 0;
    const replyCount =
      img.replyCount?.N !== undefined ? Number(img.replyCount.N) : 0;
    const quoteCount =
      img.quoteCount?.N !== undefined ? Number(img.quoteCount.N) : 0;
    const sentiment = img.sentiment?.S;

    // Author dedup key for per-batch author-level aggregates
    const authorKey = `${query}|${authorUsername}`;
    const isFirstAuthorOccurrence = !seenAuthors.has(authorKey);
    if (isFirstAuthorOccurrence) seenAuthors.add(authorKey);

    // ── Existing aggregates (must not be regressed) ───────────────────────
    try {
      await incrementPulse(query, minuteBucket);
    } catch (err) {
      console.error("[aggregator] pulse error:", err);
    }

    // sentiment-by-symbol: delegated to sentiment.ts Lambda; nothing to do here.

    // ── Hashtags (existing — keeping incremental function + new fan-out) ──
    try {
      if (hashtags.length > 0) {
        await incrementHourlyHashtags(query, hourBucket, hashtags);
      }
    } catch (err) {
      console.error("[aggregator] incrementHourlyHashtags error:", err);
    }

    // ── Mentions (existing) ───────────────────────────────────────────────
    try {
      if (mentions.length > 0) {
        await incrementHourlyMentions(query, hourBucket, mentions);
      }
    } catch (err) {
      console.error("[aggregator] incrementHourlyMentions error:", err);
    }

    // ── Domains (existing) ────────────────────────────────────────────────
    try {
      if (urls.length > 0) {
        await incrementHourlyDomains(query, hourBucket, urls.map(extractDomain).filter((d): d is string => d !== null));
      }
    } catch (err) {
      console.error("[aggregator] incrementHourlyDomains error:", err);
    }

    // ── 13 new aggregate fan-out writes ───────────────────────────────────

    // 1. HASHTAG (new rollup row — same data as incrementHourlyHashtags above
    //    but via the new schema with value in sk; the existing one also writes
    //    to AGG#HASHTAG#... so both point at the same rows — no double-write)
    // NOTE: incrementHourlyHashtags already writes to AGG#HASHTAG#${query} /
    //       BUCKET#${hourBucket}#${hashtag} — same keys as aggregateHashtags.
    //       Skip the new helper to avoid double-counting.

    // 2. MENTION — skip for same reason (incrementHourlyMentions covers it)

    // 3. DOMAIN — skip for same reason (incrementHourlyDomains covers it)

    // 4. BIO_DOMAIN (per unique author per batch)
    try {
      if (isFirstAuthorOccurrence && authorBioUrls.length > 0) {
        await aggregateBioDomains(authorBioUrls, query, hourBucket);
      }
    } catch (err) {
      console.error("[aggregator] bioDomain error:", err);
    }

    // 5. LANG
    try {
      await aggregateLang(lang, query, hourBucket);
    } catch (err) {
      console.error("[aggregator] lang error:", err);
    }

    // 6. SOURCE — TODO Phase X: needs `source` field on TweetRecord.
    //    twitterapi.io does not return it yet; skipped.

    // 7. VERIFICATION (per unique author per batch)
    try {
      if (isFirstAuthorOccurrence) {
        await aggregateVerification(authorIsBlueVerified, authorVerifiedType, query, hourBucket);
      }
    } catch (err) {
      console.error("[aggregator] verification error:", err);
    }

    // 8. BOT (per unique author per batch)
    try {
      if (isFirstAuthorOccurrence) {
        await aggregateBot(authorIsAutomated, botScore, query, hourBucket);
      }
    } catch (err) {
      console.error("[aggregator] bot error:", err);
    }

    // 9. HEATMAP
    try {
      await aggregateHeatmap(ts, query, hourBucket);
    } catch (err) {
      console.error("[aggregator] heatmap error:", err);
    }

    // 10. KEYWORD
    try {
      if (keywords.length > 0) {
        await aggregateKeywords(keywords, query, hourBucket);
      }
    } catch (err) {
      console.error("[aggregator] keywords error:", err);
    }

    // 11. AUTHOR_INFLUENCE (per unique author per batch)
    try {
      if (isFirstAuthorOccurrence) {
        await aggregateAuthorInfluence(authorFollowers, query, hourBucket);
      }
    } catch (err) {
      console.error("[aggregator] authorInfluence error:", err);
    }

    // 12. ENGAGEMENT
    try {
      await aggregateEngagement(likeCount, retweetCount, replyCount, quoteCount, query, hourBucket);
    } catch (err) {
      console.error("[aggregator] engagement error:", err);
    }

    // 13. SENTIMENT_BY_QUERY
    // Note: sentiment is populated async by sentiment.ts Lambda on MODIFY events.
    // On INSERT this field will be absent; this write will be a no-op (skipped
    // inside aggregateSentimentByQuery). Sentiment aggregation for this type
    // is therefore driven by the sentiment.ts handler, which should also call
    // incrementSentimentByQuery when it writes the sentiment field.
    try {
      await aggregateSentimentByQuery(sentiment, query, hourBucket);
    } catch (err) {
      console.error("[aggregator] sentimentByQuery error:", err);
    }
  }
};
