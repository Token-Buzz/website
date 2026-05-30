import { describe, it, expect } from 'vitest'
import { APIFY_ACTORS } from './apify-actors'
import type { SocialSource } from '../sources/types'

// ── Registry completeness ─────────────────────────────────────────────────────

describe('APIFY_ACTORS registry', () => {
  const allSources: SocialSource[] = ['twitter', 'reddit', 'farcaster', 'telegram', 'discord']

  it('contains all 5 source keys', () => {
    for (const source of allSources) {
      expect(APIFY_ACTORS).toHaveProperty(source)
    }
    expect(Object.keys(APIFY_ACTORS)).toHaveLength(5)
  })

  it('each entry has a non-empty actorId', () => {
    for (const source of allSources) {
      expect(typeof APIFY_ACTORS[source].actorId).toBe('string')
      expect(APIFY_ACTORS[source].actorId.length).toBeGreaterThan(0)
    }
  })

  it('each entry has buildInput and normalize functions', () => {
    for (const source of allSources) {
      expect(typeof APIFY_ACTORS[source].buildInput).toBe('function')
      expect(typeof APIFY_ACTORS[source].normalize).toBe('function')
    }
  })
})

// ── Default actor ids ─────────────────────────────────────────────────────────

describe('default actor ids', () => {
  it('twitter → apidojo~tweet-scraper', () => {
    expect(APIFY_ACTORS.twitter.actorId).toBe('apidojo~tweet-scraper')
  })

  it('reddit → trudax~reddit-scraper', () => {
    expect(APIFY_ACTORS.reddit.actorId).toBe('trudax~reddit-scraper')
  })

  it('farcaster → misceres~farcaster-scraper', () => {
    expect(APIFY_ACTORS.farcaster.actorId).toBe('misceres~farcaster-scraper')
  })

  it('telegram → 73mincrease~telegram-scraper', () => {
    expect(APIFY_ACTORS.telegram.actorId).toBe('73mincrease~telegram-scraper')
  })

  it('discord → speakol~discord-scraper', () => {
    expect(APIFY_ACTORS.discord.actorId).toBe('speakol~discord-scraper')
  })
})

// ── Twitter: buildInput & normalize ───────────────────────────────────────────

describe('twitter actor', () => {
  const spec = APIFY_ACTORS.twitter

  describe('buildInput', () => {
    it('includes the query in searchTerms', () => {
      const input = spec.buildInput('solana crypto')
      expect((input['searchTerms'] as string[])[0]).toBe('solana crypto')
    })

    it('sets default maxItems when not provided', () => {
      const input = spec.buildInput('bitcoin')
      expect(typeof input['maxItems']).toBe('number')
      expect(input['maxItems']).toBeGreaterThan(0)
    })

    it('respects the maxItems option', () => {
      const input = spec.buildInput('eth', { maxItems: 25 })
      expect(input['maxItems']).toBe(25)
    })
  })

  describe('normalize', () => {
    const sampleRow = {
      id: 'tweet123',
      text: 'SOL is pumping hard today!',
      createdAt: '2024-01-01T00:00:00.000Z',
      likeCount: 42,
      retweetCount: 10,
      replyCount: 5,
      quoteCount: 2,
      viewCount: 500,
      bookmarkCount: 3,
      lang: 'en',
      isReply: false,
      conversationId: 'tweet123',
      author: {
        userName: 'cryptofan',
        id: 'user456',
        name: 'Crypto Fan',
        isBlueVerified: true,
        followers: 1000,
        following: 200,
        statusesCount: 300,
        description: 'Crypto enthusiast',
        profilePicture: 'https://example.com/pic.jpg',
      },
      entities: {
        hashtags: [{ text: 'SOL' }, { text: 'crypto' }],
        user_mentions: [{ screen_name: 'solana' }],
        urls: [{ expanded_url: 'https://solana.com' }],
      },
    }

    it('maps id and text correctly', () => {
      const result = spec.normalize(sampleRow)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('tweet123')
      expect(result!.text).toBe('SOL is pumping hard today!')
    })

    it('maps all count fields', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.likeCount).toBe(42)
      expect(result.retweetCount).toBe(10)
      expect(result.replyCount).toBe(5)
      expect(result.quoteCount).toBe(2)
      expect(result.viewCount).toBe(500)
      expect(result.bookmarkCount).toBe(3)
    })

    it('maps author fields', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.author.userName).toBe('cryptofan')
      expect(result.author.id).toBe('user456')
      expect(result.author.name).toBe('Crypto Fan')
      expect(result.author.isBlueVerified).toBe(true)
      expect(result.author.followers).toBe(1000)
    })

    it('maps entities correctly', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.entities?.hashtags).toEqual([{ text: 'SOL' }, { text: 'crypto' }])
      expect(result.entities?.user_mentions).toEqual([{ screen_name: 'solana' }])
      expect(result.entities?.urls).toEqual([{ expanded_url: 'https://solana.com' }])
    })

    it('returns null for null input', () => {
      expect(spec.normalize(null)).toBeNull()
    })

    it('returns null for empty object (no id or text)', () => {
      expect(spec.normalize({})).toBeNull()
    })

    it('returns null when id is missing', () => {
      const { id: _id, ...noId } = sampleRow
      expect(spec.normalize(noId)).toBeNull()
    })

    it('returns null when text is missing', () => {
      const { text: _text, ...noText } = sampleRow
      expect(spec.normalize(noText)).toBeNull()
    })

    it('returns null for a string input', () => {
      expect(spec.normalize('garbage')).toBeNull()
    })

    it('returns null for numeric input', () => {
      expect(spec.normalize(42)).toBeNull()
    })
  })
})

// ── Reddit: buildInput & normalize ────────────────────────────────────────────

describe('reddit actor', () => {
  const spec = APIFY_ACTORS.reddit

  describe('buildInput', () => {
    it('includes the query in searches array', () => {
      const input = spec.buildInput('solana')
      expect(Array.isArray(input['searches'])).toBe(true)
      expect((input['searches'] as string[])[0]).toBe('solana')
    })

    it('respects maxItems option', () => {
      const input = spec.buildInput('bitcoin', { maxItems: 50 })
      expect(input['maxItems']).toBe(50)
    })

    it('includes sort field', () => {
      const input = spec.buildInput('eth')
      expect(input['sort']).toBeDefined()
    })
  })

  describe('normalize', () => {
    const sampleRow = {
      id: 'reddit_post_1',
      title: 'Is Solana the future?',
      selftext: 'Discussion post body here.',
      createdAt: '2024-01-01T00:00:00.000Z',
      score: 99,
      numComments: 33,
      author: 'redditor99',
      subreddit: 'CryptoMoonShots',
      url: 'https://reddit.com/r/CryptoMoonShots/comments/reddit_post_1/',
      name: 't3_reddit_post_1',
    }

    it('maps id and combines title+selftext as text', () => {
      const result = spec.normalize(sampleRow)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('reddit_post_1')
      expect(result!.text).toBe('Is Solana the future?\n\nDiscussion post body here.')
    })

    it('uses title alone when selftext is empty', () => {
      const row = { ...sampleRow, selftext: '' }
      const result = spec.normalize(row)!
      expect(result.text).toBe('Is Solana the future?')
    })

    it('maps score to likeCount', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.likeCount).toBe(99)
    })

    it('maps numComments to replyCount', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.replyCount).toBe(33)
    })

    it('maps author to author userName/id/name', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.author.userName).toBe('redditor99')
      expect(result.author.id).toBe('redditor99')
      expect(result.author.name).toBe('redditor99')
    })

    it('excludes reddit.com urls from entities', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.entities?.urls).toEqual([])
    })

    it('includes non-reddit external urls in entities', () => {
      const row = { ...sampleRow, url: 'https://solana.com/news' }
      const result = spec.normalize(row)!
      expect(result.entities?.urls).toEqual([{ expanded_url: 'https://solana.com/news' }])
    })

    it('accepts created_utc (epoch seconds) when createdAt is absent', () => {
      const { createdAt: _ca, ...withoutCreatedAt } = sampleRow
      const row = { ...withoutCreatedAt, created_utc: 1700000000 }
      const result = spec.normalize(row)!
      expect(result.createdAt).toBe(new Date(1700000000 * 1000).toISOString())
    })

    it('returns null for null input', () => {
      expect(spec.normalize(null)).toBeNull()
    })

    it('returns null for empty object', () => {
      expect(spec.normalize({})).toBeNull()
    })

    it('returns null when id is missing', () => {
      const { id: _id, ...noId } = sampleRow
      expect(spec.normalize(noId)).toBeNull()
    })

    it('returns null when title is missing', () => {
      const { title: _t, ...noTitle } = sampleRow
      expect(spec.normalize(noTitle)).toBeNull()
    })
  })
})

// ── Farcaster: buildInput & normalize ─────────────────────────────────────────

describe('farcaster actor', () => {
  const spec = APIFY_ACTORS.farcaster

  describe('buildInput', () => {
    it('includes the query in searchQuery', () => {
      const input = spec.buildInput('farcaster solana')
      expect(input['searchQuery']).toBe('farcaster solana')
    })

    it('respects maxItems option', () => {
      const input = spec.buildInput('eth', { maxItems: 30 })
      expect(input['maxItems']).toBe(30)
    })
  })

  describe('normalize', () => {
    const sampleRow = {
      hash: 'cast_abc123',
      text: 'Building on Farcaster is amazing!',
      timestamp: '2024-01-01T12:00:00.000Z',
      parentHash: null,
      threadHash: 'cast_abc123',
      author: {
        fid: 42,
        username: 'builder',
        displayName: 'Builder Dev',
        followerCount: 500,
        followingCount: 100,
      },
      reactions: {
        likesCount: 22,
        recastsCount: 5,
      },
      replies: {
        count: 3,
      },
    }

    it('maps hash to id and text', () => {
      const result = spec.normalize(sampleRow)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('cast_abc123')
      expect(result!.text).toBe('Building on Farcaster is amazing!')
    })

    it('maps reactions to like/retweet counts', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.likeCount).toBe(22)
      expect(result.retweetCount).toBe(5)
      expect(result.replyCount).toBe(3)
    })

    it('maps author fields', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.author.userName).toBe('builder')
      expect(result.author.id).toBe('42')
      expect(result.author.name).toBe('Builder Dev')
      expect(result.author.followers).toBe(500)
      expect(result.author.following).toBe(100)
    })

    it('sets isReply=false when parentHash is null', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.isReply).toBe(false)
    })

    it('sets isReply=true when parentHash is present', () => {
      const row = { ...sampleRow, parentHash: 'cast_parent_xyz' }
      const result = spec.normalize(row)!
      expect(result.isReply).toBe(true)
      expect(result.inReplyToId).toBe('cast_parent_xyz')
    })

    it('returns null for null input', () => {
      expect(spec.normalize(null)).toBeNull()
    })

    it('returns null for empty object', () => {
      expect(spec.normalize({})).toBeNull()
    })

    it('returns null when hash is missing', () => {
      const { hash: _h, ...noHash } = sampleRow
      expect(spec.normalize(noHash)).toBeNull()
    })

    it('returns null when text is missing', () => {
      const { text: _t, ...noText } = sampleRow
      expect(spec.normalize(noText)).toBeNull()
    })
  })
})

// ── Telegram: buildInput & normalize ──────────────────────────────────────────

describe('telegram actor', () => {
  const spec = APIFY_ACTORS.telegram

  describe('buildInput', () => {
    it('includes the query in queries array', () => {
      const input = spec.buildInput('telegram_channel')
      expect(Array.isArray(input['queries'])).toBe(true)
      expect((input['queries'] as string[])[0]).toBe('telegram_channel')
    })

    it('respects maxItems option', () => {
      const input = spec.buildInput('crypto_news', { maxItems: 75 })
      expect(input['maxItems']).toBe(75)
    })
  })

  describe('normalize', () => {
    const sampleRow = {
      id: 12345,
      channelName: 'cointelegraph',
      channelTitle: 'Cointelegraph',
      text: 'Bitcoin hits new ATH today!',
      date: 1700000000, // epoch seconds
      views: 10000,
      forwards: 250,
      replies: 42,
    }

    it('composes id as channel:msgId', () => {
      const result = spec.normalize(sampleRow)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('cointelegraph:12345')
    })

    it('maps text correctly', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.text).toBe('Bitcoin hits new ATH today!')
    })

    it('converts epoch seconds date to ISO string', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.createdAt).toBe(new Date(1700000000 * 1000).toISOString())
    })

    it('maps views to viewCount', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.viewCount).toBe(10000)
    })

    it('maps forwards to retweetCount', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.retweetCount).toBe(250)
    })

    it('maps replies to replyCount', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.replyCount).toBe(42)
    })

    it('maps channel to author fields', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.author.userName).toBe('cointelegraph')
      expect(result.author.id).toBe('cointelegraph')
      expect(result.author.name).toBe('Cointelegraph')
    })

    it('accepts an ISO date string', () => {
      const row = { ...sampleRow, date: '2024-01-01T00:00:00.000Z' }
      const result = spec.normalize(row)!
      expect(result.createdAt).toBe('2024-01-01T00:00:00.000Z')
    })

    it('returns null for null input', () => {
      expect(spec.normalize(null)).toBeNull()
    })

    it('returns null for empty object', () => {
      expect(spec.normalize({})).toBeNull()
    })

    it('returns null when id is missing', () => {
      const { id: _id, ...noId } = sampleRow
      expect(spec.normalize(noId)).toBeNull()
    })

    it('returns null when text is missing', () => {
      const { text: _t, ...noText } = sampleRow
      expect(spec.normalize(noText)).toBeNull()
    })
  })
})

// ── Discord: buildInput & normalize ───────────────────────────────────────────

describe('discord actor', () => {
  const spec = APIFY_ACTORS.discord

  describe('buildInput', () => {
    it('includes the query in searchQuery', () => {
      const input = spec.buildInput('solana NFT')
      expect(input['searchQuery']).toBe('solana NFT')
    })

    it('respects maxItems option', () => {
      const input = spec.buildInput('crypto', { maxItems: 20 })
      expect(input['maxItems']).toBe(20)
    })
  })

  describe('normalize', () => {
    const sampleRow = {
      id: 'discord_msg_789',
      guildId: 'guild_001',
      guildName: 'Crypto Hub',
      channelId: 'chan_001',
      channelName: 'general',
      content: 'When moon? LFG! 🚀',
      timestamp: '2024-01-01T10:00:00.000Z',
      authorId: 'user_discord_abc',
      authorUsername: 'moonboy42',
      authorGlobalName: 'MoonBoy',
    }

    it('maps id and content as text', () => {
      const result = spec.normalize(sampleRow)
      expect(result).not.toBeNull()
      expect(result!.id).toBe('discord_msg_789')
      expect(result!.text).toBe('When moon? LFG! 🚀')
    })

    it('maps createdAt from timestamp', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.createdAt).toBe('2024-01-01T10:00:00.000Z')
    })

    it('maps author fields', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.author.userName).toBe('moonboy42')
      expect(result.author.id).toBe('user_discord_abc')
      expect(result.author.name).toBe('MoonBoy')
    })

    it('falls back to authorUsername when authorGlobalName is absent', () => {
      const { authorGlobalName: _agn, ...noGlobalName } = sampleRow
      const result = spec.normalize(noGlobalName)!
      expect(result.author.name).toBe('moonboy42')
    })

    it('sets all engagement counts to 0 (Discord has no public counts)', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.likeCount).toBe(0)
      expect(result.retweetCount).toBe(0)
      expect(result.replyCount).toBe(0)
      expect(result.quoteCount).toBe(0)
      expect(result.viewCount).toBe(0)
      expect(result.bookmarkCount).toBe(0)
    })

    it('sets isReply=false and lang="en"', () => {
      const result = spec.normalize(sampleRow)!
      expect(result.isReply).toBe(false)
      expect(result.lang).toBe('en')
    })

    it('returns null for null input', () => {
      expect(spec.normalize(null)).toBeNull()
    })

    it('returns null for empty object', () => {
      expect(spec.normalize({})).toBeNull()
    })

    it('returns null when id is missing', () => {
      const { id: _id, ...noId } = sampleRow
      expect(spec.normalize(noId)).toBeNull()
    })

    it('returns null when content is missing', () => {
      const { content: _c, ...noContent } = sampleRow
      expect(spec.normalize(noContent)).toBeNull()
    })
  })
})
