// Shared per-tweet enrichment helper.
// Called by both the query route (packages/application/app/api/query/route.ts)
// and the background poller (packages/jobs/src/poller.ts + engagement-snapshot.ts).

import { computeBotScore } from "../db/bot-heuristic";
import { extractKeywords } from "../db/keywords";
import type { RawTweet } from "./twitter";
import type { Tweet } from "../db/tweets";
import type { GeoResult } from "../db/geo";
import type { SocialSource } from "../sources/types";

// ── URL regex ─────────────────────────────────────────────────────────────────
const URL_REGEX = /https?:\/\/[\w./?=&%+#-]+/g;

function extractUrls(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(URL_REGEX) ?? []));
}

export interface EnrichOpts {
  /** Pre-resolved geo result for the author's location. Skip (pass undefined/null) when geo lookup is not available. */
  geoResult?: GeoResult | null;
  /** Pre-computed bot score. If omitted it is computed from the author fields. */
  botScore?: number;
  /** Social network this post originated from. Defaults to 'twitter'. */
  source?: SocialSource;
}

/**
 * Builds a fully-enriched Tweet record from a raw twitterapi.io tweet.
 *
 * @param raw     Raw tweet from the twitterapi.io response
 * @param query   The search query / token symbol this tweet was fetched for
 * @param opts    Optional pre-resolved geo result and/or bot score
 */
export function enrichRawTweet(
  raw: RawTweet,
  query: string,
  opts?: EnrichOpts,
): Tweet {
  const author = raw.author;

  // Bot score
  let botScore: number;
  if (opts?.botScore !== undefined) {
    botScore = opts.botScore;
  } else {
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
    ({ botScore } = computeBotScore({
      statusesCount: author.statusesCount,
      followers: author.followers,
      following: author.following,
      accountAgeDays,
      profilePictureUrl: author.profilePicture,
      description: author.description,
    }));
  }

  // Keywords
  const keywords = extractKeywords(raw.text, { max: 10 });

  // URLs from tweet text / entities
  const tweetUrls =
    raw.entities?.urls?.map((u) => u.expanded_url).filter(Boolean) ??
    extractUrls(raw.text);

  // Bio URLs from author description
  const authorBioUrls = extractUrls(author.description);

  // Geo
  const rawLocation = author.location?.trim();
  const geoResult = opts?.geoResult ?? null;

  return {
    source: opts?.source ?? 'twitter',
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
    mentions: raw.entities?.user_mentions?.map((m) => m.screen_name) ?? [],
    urls: tweetUrls,
    // ── Analytics extension fields ───────────────────────────────────────────
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
}
