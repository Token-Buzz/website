// Per-source Apify actor registry + pure normalizers.
// Used by the Apify all-in-one BYOK ingestion mode (M9 Phase 8).
//
// Each entry maps a SocialSource to:
//   - the default public Apify actor id to use for that source
//   - a buildInput factory that constructs the actor run input from a query
//   - a defensive normalize function that maps one dataset row → RawTweet | null

import type { RawTweet } from './twitter'
import type { SocialSource } from '../sources/types'

export interface ApifyActorSpec {
  /** Apify actor id (the default public actor for this source; '~' form for the path). */
  actorId: string
  /** Build the actor run input for a search query. maxItems caps results. */
  buildInput(query: string, opts?: { maxItems?: number }): Record<string, unknown>
  /**
   * Map ONE dataset row to a RawTweet, or return null to skip an unmappable row.
   * Must be pure & defensive (rows are `unknown`).
   */
  normalize(row: unknown): RawTweet | null
}

// ── Safe property access helpers ─────────────────────────────────────────────

function asRecord(v: unknown): Record<string, unknown> | null {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return null
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

// ── Twitter normalizer ────────────────────────────────────────────────────────
// Default actor: apidojo~tweet-scraper (https://apify.com/apidojo/tweet-scraper)
// Typical dataset row shape (apidojo tweet-scraper output):
// {
//   id, text, createdAt, likeCount, retweetCount, replyCount, quoteCount,
//   viewCount, bookmarkCount, lang, isReply, conversationId,
//   author: { userName, id, name, isBlueVerified, followers, following,
//             statusesCount, description, profilePicture }
//   entities: { hashtags, user_mentions, urls }
// }
// The actor output closely mirrors the RawTweet shape already.

function normalizeTwitter(row: unknown): RawTweet | null {
  const r = asRecord(row)
  if (!r) return null

  const id = str(r['id'])
  const text = str(r['text'])
  if (!id || !text) return null

  const authorRec = asRecord(r['author'])
  const entRec = asRecord(r['entities'])

  const hashtags = Array.isArray(entRec?.['hashtags'])
    ? (entRec!['hashtags'] as unknown[]).flatMap((h) => {
        const hr = asRecord(h)
        const t = str(hr?.['text'])
        return t ? [{ text: t }] : []
      })
    : []

  const user_mentions = Array.isArray(entRec?.['user_mentions'])
    ? (entRec!['user_mentions'] as unknown[]).flatMap((m) => {
        const mr = asRecord(m)
        const sn = str(mr?.['screen_name'])
        return sn ? [{ screen_name: sn }] : []
      })
    : []

  const urls = Array.isArray(entRec?.['urls'])
    ? (entRec!['urls'] as unknown[]).flatMap((u) => {
        const ur = asRecord(u)
        const eu = str(ur?.['expanded_url'])
        return eu ? [{ expanded_url: eu }] : []
      })
    : []

  return {
    id,
    text,
    createdAt: str(r['createdAt'], new Date().toISOString()),
    likeCount: num(r['likeCount']),
    retweetCount: num(r['retweetCount']),
    replyCount: num(r['replyCount']),
    quoteCount: num(r['quoteCount']),
    viewCount: num(r['viewCount']),
    bookmarkCount: num(r['bookmarkCount']),
    lang: str(r['lang'], 'en'),
    isReply: bool(r['isReply']),
    conversationId: str(r['conversationId']) || undefined,
    inReplyToId: str(r['inReplyToId']) || undefined,
    author: {
      userName: str(authorRec?.['userName']),
      id: str(authorRec?.['id']),
      name: str(authorRec?.['name']),
      isBlueVerified: bool(authorRec?.['isBlueVerified']),
      profilePicture: str(authorRec?.['profilePicture']) || undefined,
      followers: num(authorRec?.['followers']),
      following: num(authorRec?.['following']),
      statusesCount: num(authorRec?.['statusesCount']),
      description: str(authorRec?.['description']) || undefined,
    },
    entities: { hashtags, user_mentions, urls },
  }
}

// ── Reddit normalizer ─────────────────────────────────────────────────────────
// Default actor: trudax~reddit-scraper (https://apify.com/trudax/reddit-scraper)
// Typical dataset row shape (trudax reddit-scraper output):
// {
//   id, title, selftext?, createdAt (ISO) or created_utc (epoch s),
//   score, numComments, author, subreddit, url, permalink
// }

function normalizeReddit(row: unknown): RawTweet | null {
  const r = asRecord(row)
  if (!r) return null

  const id = str(r['id'])
  const title = str(r['title'])
  if (!id || !title) return null

  const selftext = str(r['selftext'])
  const text = selftext ? `${title}\n\n${selftext}` : title

  // createdAt: prefer ISO string; fall back to created_utc epoch seconds
  let createdAt: string
  const createdAtRaw = r['createdAt']
  if (typeof createdAtRaw === 'string' && createdAtRaw) {
    createdAt = createdAtRaw
  } else {
    const utc = num(r['created_utc'])
    createdAt = utc ? new Date(utc * 1000).toISOString() : new Date().toISOString()
  }

  const author = str(r['author'], 'unknown')
  const postUrl = str(r['url'])
  const externalUrls =
    postUrl && !postUrl.includes('reddit.com') ? [{ expanded_url: postUrl }] : []

  return {
    id,
    text,
    createdAt,
    likeCount: num(r['score']),
    retweetCount: 0,
    replyCount: num(r['numComments']),
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    conversationId: str(r['name']) || undefined,
    inReplyToId: undefined,
    author: {
      userName: author,
      id: author,
      name: author,
      isBlueVerified: false,
      followers: 0,
      following: 0,
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: externalUrls,
    },
  }
}

// ── Farcaster normalizer ──────────────────────────────────────────────────────
// Default actor: misceres~farcaster-scraper (https://apify.com/misceres/farcaster-scraper)
// Configurable default — swap actorId to another farcaster actor as needed.
// Typical dataset row shape:
// {
//   hash, text, timestamp (ISO), parentHash?,
//   author: { fid, username, displayName, followerCount, followingCount },
//   reactions: { likesCount, recastsCount },
//   replies: { count }
// }

function normalizeFarcaster(row: unknown): RawTweet | null {
  const r = asRecord(row)
  if (!r) return null

  const id = str(r['hash'])
  const text = str(r['text'])
  if (!id || !text) return null

  const authorRec = asRecord(r['author'])
  const reactionsRec = asRecord(r['reactions'])
  const repliesRec = asRecord(r['replies'])

  const fid = num(authorRec?.['fid'])
  const username = str(authorRec?.['username'])
  const displayName = str(authorRec?.['displayName']) || str(authorRec?.['display_name']) || username

  const parentHash = str(r['parentHash']) || str(r['parent_hash'])

  return {
    id,
    text,
    createdAt: str(r['timestamp'], new Date().toISOString()),
    likeCount: num(reactionsRec?.['likesCount']) || num(reactionsRec?.['likes_count']),
    retweetCount: num(reactionsRec?.['recastsCount']) || num(reactionsRec?.['recasts_count']),
    replyCount: num(repliesRec?.['count']),
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: !!parentHash,
    conversationId: str(r['threadHash']) || str(r['thread_hash']) || undefined,
    inReplyToId: parentHash || undefined,
    author: {
      userName: username,
      id: fid ? String(fid) : username,
      name: displayName,
      isBlueVerified: false,
      followers: num(authorRec?.['followerCount']) || num(authorRec?.['follower_count']),
      following: num(authorRec?.['followingCount']) || num(authorRec?.['following_count']),
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: [],
    },
  }
}

// ── Telegram normalizer ───────────────────────────────────────────────────────
// Default actor: 73mincrease~telegram-scraper (https://apify.com/73mincrease/telegram-scraper)
// Configurable default — swap actorId to another telegram actor as needed.
// Typical dataset row shape:
// {
//   id (number), channelName, channelTitle?, text, date (ISO or epoch s),
//   views, forwards, replies
// }

function normalizeTelegram(row: unknown): RawTweet | null {
  const r = asRecord(row)
  if (!r) return null

  const msgId = r['id']
  const idStr = typeof msgId === 'number' ? String(msgId) : str(msgId)
  const text = str(r['text'])
  if (!idStr || !text) return null

  const channel = str(r['channelName']) || str(r['channel'])
  const channelTitle = str(r['channelTitle']) || channel

  // Compose a globally-unique id: channel:id (mirrors telegram.ts messageToRawTweet)
  const id = channel ? `${channel}:${idStr}` : idStr

  // createdAt: prefer ISO string from 'date'; fall back to epoch seconds
  let createdAt: string
  const dateRaw = r['date']
  if (typeof dateRaw === 'string' && dateRaw) {
    createdAt = dateRaw
  } else {
    const epochMs = num(dateRaw)
    // Apify typically gives epoch seconds for Telegram; if > 1e12 it's already ms
    createdAt = epochMs
      ? new Date(epochMs > 1e12 ? epochMs : epochMs * 1000).toISOString()
      : new Date().toISOString()
  }

  return {
    id,
    text,
    createdAt,
    likeCount: 0,
    retweetCount: num(r['forwards']),
    replyCount: num(r['replies']),
    quoteCount: 0,
    viewCount: num(r['views']),
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    author: {
      userName: channel,
      id: channel,
      name: channelTitle,
      isBlueVerified: false,
      followers: 0,
      following: 0,
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: [],
    },
  }
}

// ── Discord normalizer ────────────────────────────────────────────────────────
// Default actor: speakol~discord-scraper (https://apify.com/speakol/discord-scraper)
// Configurable default — swap actorId to another discord actor as needed.
// Typical dataset row shape:
// {
//   id, guildId, guildName?, channelId, channelName?, content, timestamp (ISO),
//   authorId, authorUsername, authorGlobalName?
// }

function normalizeDiscord(row: unknown): RawTweet | null {
  const r = asRecord(row)
  if (!r) return null

  const id = str(r['id'])
  const content = str(r['content'])
  if (!id || !content) return null

  const authorId = str(r['authorId'])
  const authorUsername = str(r['authorUsername'])
  const authorGlobalName = str(r['authorGlobalName']) || authorUsername

  return {
    id,
    text: content,
    createdAt: str(r['timestamp'], new Date().toISOString()),
    likeCount: 0,
    retweetCount: 0,
    replyCount: 0,
    quoteCount: 0,
    viewCount: 0,
    bookmarkCount: 0,
    lang: 'en',
    isReply: false,
    conversationId: undefined,
    inReplyToId: undefined,
    author: {
      userName: authorUsername,
      id: authorId,
      name: authorGlobalName,
      isBlueVerified: false,
      followers: 0,
      following: 0,
      statusesCount: 0,
    },
    entities: {
      hashtags: [],
      user_mentions: [],
      urls: [],
    },
  }
}

// ── Actor registry ────────────────────────────────────────────────────────────

export const APIFY_ACTORS: Record<SocialSource, ApifyActorSpec> = {
  twitter: {
    // apidojo~tweet-scraper: https://apify.com/apidojo/tweet-scraper
    actorId: 'apidojo~tweet-scraper',
    buildInput(query, opts) {
      return {
        // searchTerms is an array of search queries for this actor
        searchTerms: [query],
        maxItems: opts?.maxItems ?? 100,
        // Sort by 'Latest' to get the most recent matching tweets
        queryType: 'Latest',
      }
    },
    normalize: normalizeTwitter,
  },

  reddit: {
    // trudax~reddit-scraper: https://apify.com/trudax/reddit-scraper
    actorId: 'trudax~reddit-scraper',
    buildInput(query, opts) {
      return {
        // searches: array of search terms for this actor
        searches: [query],
        maxItems: opts?.maxItems ?? 100,
        // Sort by newest posts first
        sort: 'new',
      }
    },
    normalize: normalizeReddit,
  },

  farcaster: {
    // misceres~farcaster-scraper: https://apify.com/misceres/farcaster-scraper
    // Configurable default — replace actorId with the preferred farcaster actor.
    actorId: 'misceres~farcaster-scraper',
    buildInput(query, opts) {
      return {
        // searchQuery: string search term for this actor
        searchQuery: query,
        maxItems: opts?.maxItems ?? 100,
      }
    },
    normalize: normalizeFarcaster,
  },

  telegram: {
    // 73mincrease~telegram-scraper: https://apify.com/73mincrease/telegram-scraper
    // Configurable default — replace actorId with the preferred telegram actor.
    actorId: '73mincrease~telegram-scraper',
    buildInput(query, opts) {
      return {
        // queries: array of channel names or search terms for this actor
        queries: [query],
        maxItems: opts?.maxItems ?? 100,
      }
    },
    normalize: normalizeTelegram,
  },

  discord: {
    // speakol~discord-scraper: https://apify.com/speakol/discord-scraper
    // Configurable default — replace actorId with the preferred discord actor.
    actorId: 'speakol~discord-scraper',
    buildInput(query, opts) {
      return {
        // searchQuery: string search term for this actor
        searchQuery: query,
        maxItems: opts?.maxItems ?? 100,
      }
    },
    normalize: normalizeDiscord,
  },
}
