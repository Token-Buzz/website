import { auth } from "@clerk/nextjs/server";
import { searchTweets, TwitterApiError } from "@monorepo-template/core/lib/twitter";
import { enrichRawTweet } from "@monorepo-template/core/lib/enrich";
import { putTweet } from "@monorepo-template/core/db/tweets";
import { computeBotScore } from "@monorepo-template/core/db/bot-heuristic";
import { lookupLocation, type City, type GeoResult } from "@monorepo-template/core/db/geo";
import {
  getByokKey,
  getByokKeyStatus,
  markByokKeyInvalid,
  TWITTER_PROVIDER,
} from "@monorepo-template/core/db/byok";
import citiesData from "@/lib/geo/cities5000.json";

// Load offline city dataset once at module init.
// cities5000.json is a placeholder [] until the dataset is bundled;
// the geo lookup degrades gracefully (skips offline layer, falls through to OpenCage).
const offlineCities = citiesData as unknown as City[];

// ── Hand-rolled concurrency limiter ──────────────────────────────────────────
// Keeps at most `concurrency` geo lookups in-flight at once.
async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  // ── Auth gate ──────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("query" in body) ||
    typeof (body as Record<string, unknown>).query !== "string" ||
    !(body as Record<string, unknown>).query
  ) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const query = ((body as Record<string, unknown>).query as string).trim();
  if (!query) {
    return Response.json({ error: "query required" }, { status: 400 });
  }

  const rawMaxPages =
    "maxPages" in (body as Record<string, unknown>)
      ? (body as Record<string, unknown>).maxPages
      : undefined;
  const maxPages =
    typeof rawMaxPages === "number"
      ? Math.min(Math.max(1, rawMaxPages), 10)
      : 5;

  // ── Gate on caller's BYOK key (status check first, decrypt only when active) ─
  const keyStatus = await getByokKeyStatus(userId, TWITTER_PROVIDER);
  if (!keyStatus) {
    return Response.json({ error: "byok_required", reason: "missing" }, { status: 403 });
  }
  if (keyStatus.status === "invalid") {
    return Response.json({ error: "byok_required", reason: "invalid" }, { status: 403 });
  }
  const stored = await getByokKey(userId, TWITTER_PROVIDER);
  if (!stored) {
    return Response.json({ error: "byok_required", reason: "missing" }, { status: 403 });
  }

  // ── Fetch tweets from twitterapi.io ───────────────────────────────────────
  let rawTweets: Awaited<ReturnType<typeof searchTweets>>;
  try {
    rawTweets = await searchTweets(stored.apiKey, query, { maxPages });
  } catch (err) {
    if (err instanceof TwitterApiError && (err.status === 401 || err.status === 403)) {
      await markByokKeyInvalid(userId, TWITTER_PROVIDER);
      return Response.json({ error: "byok_required", reason: "invalid" }, { status: 403 });
    }
    const detail = err instanceof Error ? err.message : String(err);
    if (err instanceof TwitterApiError && err.status === 429) {
      return Response.json(
        { error: "rate limited upstream", detail },
        { status: 429 },
      );
    }
    return Response.json(
      { error: "twitter ingest failed", detail },
      { status: 502 },
    );
  }

  if (rawTweets.length === 0) {
    return Response.json({ ingested: 0, query });
  }

  // ── Per-author deduplication maps (scoped to this request) ────────────────
  // Bot score: compute once per unique author username
  const botScoreCache = new Map<string, number>();
  // Geo result: compute once per unique non-empty location string
  const geoCache = new Map<string, GeoResult | null>();

  // ── Collect unique locations for geo lookup (sequential, concurrency=4) ───
  const uniqueLocations = Array.from(
    new Set(
      rawTweets
        .map((t) => t.author.location?.trim())
        .filter((loc): loc is string => !!loc),
    ),
  );

  const geoTasks = uniqueLocations.map(
    (loc) => async () => {
      try {
        const result = await lookupLocation(loc, { offlineCities });
        geoCache.set(loc, result);
      } catch {
        geoCache.set(loc, null);
      }
    },
  );

  await runWithConcurrency(geoTasks, 4);

  // ── Build and write TweetRecords ──────────────────────────────────────────
  const writeResults = await Promise.allSettled(
    rawTweets.map(async (raw) => {
      const author = raw.author;

      // Bot score — compute once per unique author username
      if (!botScoreCache.has(author.userName)) {
        let accountAgeDays = 0;
        if (author.createdAt) {
          const createdMs = new Date(author.createdAt).getTime();
          if (!isNaN(createdMs)) {
            accountAgeDays = Math.max(
              0,
              (Date.now() - createdMs) / (1000 * 60 * 60 * 24),
            );
          }
        }
        const { botScore } = computeBotScore({
          statusesCount: author.statusesCount,
          followers: author.followers,
          following: author.following,
          accountAgeDays,
          profilePictureUrl: author.profilePicture,
          description: author.description,
        });
        botScoreCache.set(author.userName, botScore);
      }
      const botScore = botScoreCache.get(author.userName)!;

      // Geo result (already resolved above)
      const rawLocation = author.location?.trim();
      const geoResult = rawLocation ? geoCache.get(rawLocation) ?? null : null;

      const tweet = enrichRawTweet(raw, query, { geoResult, botScore });

      await putTweet(tweet);
    }),
  );

  // Count successful writes; log individual failures but don't fail the request
  let ingested = 0;
  for (const result of writeResults) {
    if (result.status === "fulfilled") {
      ingested++;
    } else {
      console.error("[POST /api/query] putTweet failed:", result.reason);
    }
  }

  return Response.json({ ingested, query });
}
