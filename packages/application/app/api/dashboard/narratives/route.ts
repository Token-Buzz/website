import { requireUserId } from "@/app/_auth/requireUserId";
import { getAllTrackedQueries } from "@monorepo-template/core/db/user-data";
import { readAggregateTopK } from "@monorepo-template/core/db/aggregates";
import { bucketRange, hourBucket } from "@monorepo-template/core/db/keys";
import { detectNarratives, type TokenKeywordStats } from "@/app/(authed)/_dashboard/narratives";
import type { Narrative } from "@/app/(authed)/_dashboard/types";

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const allQueries = await getAllTrackedQueries(userId).catch(() => [] as string[]);
  if (allQueries.length === 0) {
    return Response.json({ narratives: [] });
  }

  // Cap to first 15 tokens to bound DynamoDB fan-out cost
  const tokens = allQueries.slice(0, 15);

  // ── Build time windows (mirrors today/route.ts convention) ────────────────
  // Current 24h window
  const curBuckets = bucketRange("24H", "hour");
  const curFrom = curBuckets[0];
  const curTo = curBuckets[curBuckets.length - 1];

  // Prior 24h window: the 24h preceding the current window.
  // Use hourBucket so prior-window bounds match the stored sort-key format
  // exactly ("...THH:00:00Z"); a hand-built ".000Z" string would lexically
  // exclude the final hour from the BETWEEN range.
  const priorToDate = new Date(curFrom);
  const priorFromDate = new Date(priorToDate.getTime() - 24 * 3_600_000);
  const priorFrom = hourBucket(priorFromDate);
  const priorTo = hourBucket(new Date(priorToDate.getTime() - 3_600_000));

  // ── Fan out keyword + mention reads for each token ────────────────────────
  const statsArray = await Promise.all(
    tokens.map(async (token): Promise<TokenKeywordStats> => {
      const [keywords, priorKeywords, mentions] = await Promise.all([
        readAggregateTopK({ type: "KEYWORD", query: token, from: curFrom, to: curTo, k: 20 }).catch(
          () => [] as Array<{ value: string; count: number }>,
        ),
        readAggregateTopK({
          type: "KEYWORD",
          query: token,
          from: priorFrom,
          to: priorTo,
          k: 20,
        }).catch(() => [] as Array<{ value: string; count: number }>),
        readAggregateTopK({
          type: "MENTION",
          query: token,
          from: curFrom,
          to: curTo,
          k: 20,
        }).catch(() => [] as Array<{ value: string; count: number }>),
      ]);

      // MENTION aggregate values are @handles — keep them all
      const handles = mentions.map((m) => m.value);

      return { token, keywords, priorKeywords, handles };
    }),
  );

  // ── Detect narratives ─────────────────────────────────────────────────────
  const detected = detectNarratives(statsArray);

  // Map DetectedNarrative → Narrative (types.ts shape)
  const narratives: Narrative[] = detected.map((n) => ({
    title: n.title,
    mentions: n.mentions,
    growth: n.growth,
    tokens: n.tokens,
    handles: n.handles,
    summary: n.summary,
  }));

  return Response.json({ narratives });
}
