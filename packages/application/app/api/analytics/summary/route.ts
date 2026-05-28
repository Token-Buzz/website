import { auth } from "@clerk/nextjs/server";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { readAggregateTopK, readEngagementBuckets } from "@monorepo-template/core/db/aggregates";
import { getTweetsByQueryWindow } from "@monorepo-template/core/db/tweets";
import { getTweetsByQuery, type Tweet } from "@monorepo-template/core/db/tweets";
import { bucketRange } from "@monorepo-template/core/db/keys";
import { ddb, TableNames } from "@monorepo-template/core/db/client";
import { readSourceCounts } from "@monorepo-template/core/db/source-counts";

// ── helpers ────────────────────────────────────────────────────────────────

function buckets(window: "1H" | "4H" | "24H" | "7D") {
  const range = bucketRange(window, "hour");
  return { from: range[0], to: range[range.length - 1] };
}

// Wraps a promise so a rejection returns null instead of throwing.
async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

// ── individual data fetchers (mirror exact logic of per-chart routes) ───────

async function fetchHashtags(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "HASHTAG", query, from, to, k: 10 });
  return rows.map((r) => ({ hashtag: r.value, count: r.count }));
}

async function fetchMentions(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "MENTION", query, from, to, k: 10 });
  return rows.map((r) => ({ mention: r.value, count: r.count }));
}

async function fetchDomains(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "DOMAIN", query, from, to, k: 10 });
  return rows.map((r) => ({ domain: r.value, count: r.count }));
}

async function fetchBioDomains(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "BIO_DOMAIN", query, from, to, k: 10 });
  return rows.map((r) => ({ domain: r.value, count: r.count }));
}

async function fetchLanguages(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "LANG", query, from, to, k: 100 });
  return rows.map((r) => ({ language: r.value, count: r.count }));
}

// Source distribution is not supported by twitterapi.io — always returns [].
async function fetchSourceDistribution() {
  return [] as { source: string; count: number }[];
}

async function fetchSymbolRate(query: string) {
  const timeframeMs = 24 * 60 * 60 * 1000; // 1d
  const now = Date.now();
  const from = new Date(now - timeframeMs).toISOString().slice(0, 16);
  const to = new Date(now).toISOString().slice(0, 16);

  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.aggregates,
      KeyConditionExpression: "pk = :pk AND sk BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk": `PULSE#${query}`,
        ":from": `BUCKET#${from}`,
        ":to": `BUCKET#${to}~`,
      },
      ScanIndexForward: true,
    }),
  );

  const rows = Items as Array<{ sk: string; count?: number }>;

  if (rows.length === 0) {
    return { rate: 0, sparkline: [] as number[] };
  }

  const total = rows.reduce((s, r) => s + (r.count ?? 0), 0);
  const timeframeMinutes = timeframeMs / 60_000;
  const rate = Math.round((total / timeframeMinutes) * 100) / 100;

  const hourMap = new Map<string, number>();
  for (const row of rows) {
    const bucketStr = row.sk.slice("BUCKET#".length);
    const hourKey = bucketStr.slice(0, 13);
    hourMap.set(hourKey, (hourMap.get(hourKey) ?? 0) + (row.count ?? 0));
  }

  const sparkline = Array.from(hourMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, count]) => count);

  return { rate, sparkline };
}

async function fetchEngagementTimeseries(query: string) {
  const { from, to } = buckets("24H");
  const rows = await readEngagementBuckets({ query, from, to });
  return rows;
}

async function fetchSentimentAggregation(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({
    type: "SENTIMENT_BY_QUERY",
    query,
    from,
    to,
    k: 1000,
  });

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const row of rows) {
    if (row.value === "positive") positive += row.count;
    else if (row.value === "neutral") neutral += row.count;
    else if (row.value === "negative") negative += row.count;
  }

  const total = positive + neutral + negative;
  const averageScore =
    total > 0 ? Math.round(((positive - negative) / total) * 100) / 100 : 0;

  return { positive, neutral, negative, averageScore };
}

async function fetchSentimentByQuery(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({
    type: "SENTIMENT_BY_QUERY",
    query,
    from,
    to,
    k: 1000,
  });

  if (rows.length === 0) return [] as { bucket: string; positive: number; neutral: number; negative: number }[];

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const row of rows) {
    if (row.value === "positive") positive += row.count;
    else if (row.value === "neutral") neutral += row.count;
    else if (row.value === "negative") negative += row.count;
  }

  return [{ bucket: from, positive, neutral, negative }];
}

async function fetchKeywords(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "KEYWORD", query, from, to, k: 50 });
  return rows.map((r) => ({ keyword: r.value, count: r.count }));
}

const DEPTH_ORDER = ["1", "2", "3", "4-5", "6-10", "11+"] as const;
type DepthBucket = (typeof DEPTH_ORDER)[number];

function depthBucket(depth: number): DepthBucket {
  if (depth === 1) return "1";
  if (depth === 2) return "2";
  if (depth === 3) return "3";
  if (depth <= 5) return "4-5";
  if (depth <= 10) return "6-10";
  return "11+";
}

async function fetchConversationThreads(query: string) {
  const { items, truncated } = await getTweetsByQueryWindow(query, { window: "24H", cap: 2000 });

  const threadSizes = new Map<string, number>();
  for (const tweet of items) {
    const key = tweet.conversationId ?? tweet.pk;
    threadSizes.set(key, (threadSizes.get(key) ?? 0) + 1);
  }

  const histogram = new Map<DepthBucket, number>();
  for (const b of DEPTH_ORDER) histogram.set(b, 0);

  for (const size of threadSizes.values()) {
    const bucket = depthBucket(size);
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }

  const threads = DEPTH_ORDER.filter((b) => (histogram.get(b) ?? 0) > 0).map(
    (depth) => ({ depth, count: histogram.get(depth) ?? 0 }),
  );

  return { threads, truncated };
}

async function fetchGeographic(query: string) {
  const { items, truncated } = await getTweetsByQueryWindow(query, { window: "24H", cap: 2000 });

  const countryCounts = new Map<string, number>();
  for (const tweet of items) {
    const country = tweet.authorLocationNormalized?.country;
    if (!country) continue;
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  const countries = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([country, count]) => ({ country, count }));

  return { countries, truncated };
}

async function fetchVerificationBreakdown(query: string) {
  const { from, to } = buckets("24H");
  const rows = await readAggregateTopK({ type: "VERIFICATION", query, from, to, k: 100 });

  const histogram = { blue: 0, business: 0, government: 0, unverified: 0 };
  for (const row of rows) {
    const label = row.value.toLowerCase();
    if (label === "blue") histogram.blue += row.count;
    else if (label === "business") histogram.business += row.count;
    else if (label === "government") histogram.government += row.count;
    else histogram.unverified += row.count;
  }

  return histogram;
}

async function fetchBotRatio(query: string) {
  const { from, to } = buckets("24H");
  const rows = await readAggregateTopK({ type: "BOT", query, from, to, k: 100 });

  let automated = 0;
  let notAutomated = 0;
  for (const row of rows) {
    const label = row.value.toLowerCase();
    if (label === "automated") automated += row.count;
    else notAutomated += row.count;
  }

  const total = automated + notAutomated;
  const automatedPercentage =
    total > 0 ? Math.round((automated / total) * 100 * 10) / 10 : 0;

  return { automated, notAutomated, automatedPercentage, methodology: "hybrid" as const };
}

async function fetchPostingHeatmap(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "HEATMAP", query, from, to, k: 200 });

  const VALID_DAYS = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const points: Array<{ day: string; hour: number; count: number }> = [];
  for (const row of rows) {
    const lastDash = row.value.lastIndexOf("-");
    if (lastDash === -1) continue;
    const day = row.value.slice(0, lastDash);
    const hourStr = row.value.slice(lastDash + 1);
    const hour = parseInt(hourStr, 10);
    if (!VALID_DAYS.has(day) || isNaN(hour) || hour < 0 || hour > 23) continue;
    points.push({ day, hour, count: row.count });
  }

  return points;
}

async function fetchContentLengthEngagement(query: string) {
  const { items, truncated } = await getTweetsByQueryWindow(query, { window: "24H", cap: 2000 });

  const allPoints = items.map((t) => {
    const raw = t as unknown as Record<string, number>;
    return {
      length: (t.text ?? "").length,
      engagement:
        (t.likes ?? 0) +
        (t.retweets ?? 0) +
        (t.replies ?? 0) +
        (raw["quoteCount"] ?? 0),
    };
  });

  let points = allPoints;
  if (allPoints.length > 500) {
    const sampleRate = 500 / allPoints.length;
    points = allPoints.filter(() => Math.random() < sampleRate);
    if (points.length > 500) points = points.slice(0, 500);
  }

  return { points, truncated };
}

async function fetchAuthorInfluence(query: string) {
  const { from, to } = buckets("7D");
  const rows = await readAggregateTopK({ type: "AUTHOR_INFLUENCE", query, from, to, k: 100 });

  const histogram = { low: 0, mid: 0, high: 0 };
  for (const row of rows) {
    const label = row.value.toLowerCase();
    if (label === "low") histogram.low += row.count;
    else if (label === "mid") histogram.mid += row.count;
    else if (label === "high") histogram.high += row.count;
  }

  return histogram;
}

async function fetchTweets(query: string) {
  const limit = 20;
  const { items } = await getTweetsByQuery(query, { limit });
  const tweets = (items as unknown as Tweet[]).map((t) => ({
    tweetId: t.tweetId,
    query: t.query,
    text: t.text,
    authorUsername: t.authorUsername,
    authorName: t.authorName,
    authorFollowers: t.authorFollowers,
    createdAt: t.createdAt,
    likeCount: t.likeCount,
    retweetCount: t.retweetCount,
  }));
  return { tweets, query };
}

// ── summary route ──────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) return Response.json({ error: "query required" }, { status: 400 });

  // Run all data reads in parallel; a failure in any one → null for that key.
  const [
    hashtags,
    mentions,
    domains,
    bioDomains,
    languages,
    sourceDistribution,
    symbolRate,
    engagementTimeseries,
    sentimentAggregation,
    sentimentByQuery,
    keywords,
    conversationThreads,
    geographic,
    verificationBreakdown,
    botRatio,
    postingHeatmap,
    contentLengthEngagement,
    authorInfluence,
    tweets,
    sourceCounts,
  ] = await Promise.all([
    safe(fetchHashtags(query)),
    safe(fetchMentions(query)),
    safe(fetchDomains(query)),
    safe(fetchBioDomains(query)),
    safe(fetchLanguages(query)),
    safe(fetchSourceDistribution()),
    safe(fetchSymbolRate(query)),
    safe(fetchEngagementTimeseries(query)),
    safe(fetchSentimentAggregation(query)),
    safe(fetchSentimentByQuery(query)),
    safe(fetchKeywords(query)),
    safe(fetchConversationThreads(query)),
    safe(fetchGeographic(query)),
    safe(fetchVerificationBreakdown(query)),
    safe(fetchBotRatio(query)),
    safe(fetchPostingHeatmap(query)),
    safe(fetchContentLengthEngagement(query)),
    safe(fetchAuthorInfluence(query)),
    safe(fetchTweets(query)),
    safe(readSourceCounts(query)),
  ]);

  return Response.json({
    hashtags,
    mentions,
    domains,
    bioDomains,
    languages,
    sourceDistribution,
    symbolRate,
    engagementTimeseries,
    sentimentAggregation,
    sentimentByQuery,
    keywords,
    conversationThreads,
    geographic,
    verificationBreakdown,
    botRatio,
    postingHeatmap,
    contentLengthEngagement,
    authorInfluence,
    tweets,
    sourceCounts,
  });
}
