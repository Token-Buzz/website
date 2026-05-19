import { auth } from "@clerk/nextjs/server";
import { searchTweets } from "@monorepo-template/core/lib/twitter";
import { putTweet, type Tweet } from "@monorepo-template/core/db/tweets";
import { computeBotScore } from "@monorepo-template/core/db/bot-heuristic";
import { extractKeywords } from "@monorepo-template/core/db/keywords";
import { lookupLocation, type City, type GeoResult } from "@monorepo-template/core/db/geo";
import citiesData from "@/lib/geo/cities5000.json";

// Load offline city dataset once at module init.
// cities5000.json is a placeholder [] until the dataset is bundled;
// the geo lookup degrades gracefully (skips offline layer, falls through to OpenCage).
const offlineCities = citiesData as unknown as City[];

// ── URL regex ─────────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[\w./?=&%+#-]+/g;

function extractUrls(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

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

  // ── Fetch tweets from twitterapi.io ───────────────────────────────────────
  let rawTweets: Awaited<ReturnType<typeof searchTweets>>;
  try {
    rawTweets = await searchTweets(query, { maxPages });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
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

      // Keywords
      const keywords = extractKeywords(raw.text, { max: 10 });

      // URLs from tweet text
      const tweetUrls =
        raw.entities?.urls?.map((u) => u.expandedUrl).filter(Boolean) ??
        extractUrls(raw.text);

      // Bio URLs from author description
      const authorBioUrls = extractUrls(author.description);

      const tweet: Tweet = {
        tweetId: raw.id,
        query,
        text: raw.text,
        authorUsername: author.userName,
        authorId: author.id,
        authorName: author.name,
        authorFollowers: author.followers,
        authorProfilePicture: author.profilePicture,
        createdAt: raw.createdAt,
        likeCount: raw.likeCount ?? 0,
        retweetCount: raw.retweetCount ?? 0,
        replyCount: raw.replyCount ?? 0,
        quoteCount: raw.quoteCount ?? 0,
        viewCount: raw.viewCount ?? 0,
        bookmarkCount: raw.bookmarkCount ?? 0,
        lang: raw.lang ?? "en",
        isReply: raw.isReply ?? false,
        hashtags: raw.entities?.hashtags?.map((h) => h.text) ?? [],
        mentions: raw.entities?.userMentions?.map((m) => m.screenName) ?? [],
        urls: tweetUrls,
        // ── Analytics extension fields ───────────────────────────────────────
        conversationId: raw.conversationId,
        inReplyToId: raw.inReplyToId,
        authorCreatedAt: author.createdAt,
        authorBioUrls,
        authorIsBlueVerified: author.isBlueVerified,
        authorVerifiedType: author.verifiedType,
        authorIsAutomated: author.isAutomated,
        authorLocationRaw: rawLocation ?? undefined,
        authorLocationNormalized: geoResult
          ? {
              country: geoResult.country,
              lat: geoResult.lat,
              lng: geoResult.lng,
            }
          : undefined,
        botScore,
        keywords,
      };

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
