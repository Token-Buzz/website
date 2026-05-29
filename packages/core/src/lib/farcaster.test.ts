import { describe, it, expect } from 'vitest'
import { castToRawTweet, type NeynarCast } from './farcaster'

// Representative cast fixture
const baseCast: NeynarCast = {
  hash: '0xabc123',
  text: 'Hello Farcaster! Check out https://example.com #crypto',
  timestamp: '2024-01-15T10:00:00.000Z',
  parent_hash: null,
  thread_hash: '0xthread1',
  author: {
    fid: 12345,
    username: 'alice',
    display_name: 'Alice Smith',
    pfp_url: 'https://example.com/alice.png',
    follower_count: 500,
    following_count: 200,
    profile: {
      bio: {
        text: 'Crypto enthusiast',
      },
    },
  },
  reactions: {
    likes_count: 42,
    recasts_count: 7,
  },
  replies: {
    count: 3,
  },
  mentioned_profiles: [{ username: 'bob' }, { username: 'carol' }],
  embeds: [{ url: 'https://example.com' }, { url: 'https://tokenbuzz.app' }],
}

describe('castToRawTweet', () => {
  it('maps hash to id', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.id).toBe('0xabc123')
  })

  it('maps text', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.text).toBe(baseCast.text)
  })

  it('maps timestamp to createdAt', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.createdAt).toBe('2024-01-15T10:00:00.000Z')
  })

  it('maps reaction counts correctly', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.likeCount).toBe(42)
    expect(raw.retweetCount).toBe(7)
    expect(raw.replyCount).toBe(3)
    expect(raw.quoteCount).toBe(0)
    expect(raw.viewCount).toBe(0)
    expect(raw.bookmarkCount).toBe(0)
  })

  it('sets lang to "en"', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.lang).toBe('en')
  })

  it('isReply is false when parent_hash is null', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.isReply).toBe(false)
  })

  it('isReply is true when parent_hash is set', () => {
    const reply: NeynarCast = { ...baseCast, parent_hash: '0xparent1' }
    const raw = castToRawTweet(reply)
    expect(raw.isReply).toBe(true)
    expect(raw.inReplyToId).toBe('0xparent1')
  })

  it('inReplyToId is undefined when parent_hash is null', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.inReplyToId).toBeUndefined()
  })

  it('maps conversationId from thread_hash', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.conversationId).toBe('0xthread1')
  })

  it('maps author fields correctly', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.author.userName).toBe('alice')
    expect(raw.author.id).toBe('12345')
    expect(raw.author.name).toBe('Alice Smith')
    expect(raw.author.isBlueVerified).toBe(false)
    expect(raw.author.profilePicture).toBe('https://example.com/alice.png')
    expect(raw.author.followers).toBe(500)
    expect(raw.author.following).toBe(200)
    expect(raw.author.description).toBe('Crypto enthusiast')
    expect(raw.author.statusesCount).toBe(0)
  })

  it('maps mentioned_profiles to user_mentions', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.entities?.user_mentions).toEqual([
      { screen_name: 'bob' },
      { screen_name: 'carol' },
    ])
  })

  it('maps embeds with url to entities.urls', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.entities?.urls).toEqual([
      { expanded_url: 'https://example.com' },
      { expanded_url: 'https://tokenbuzz.app' },
    ])
  })

  it('filters embeds without url', () => {
    const castWithMixedEmbeds: NeynarCast = {
      ...baseCast,
      embeds: [{ url: 'https://example.com' }, {}, { url: undefined }],
    }
    const raw = castToRawTweet(castWithMixedEmbeds)
    expect(raw.entities?.urls).toEqual([{ expanded_url: 'https://example.com' }])
  })

  it('handles missing mentioned_profiles gracefully', () => {
    const castNoMentions: NeynarCast = { ...baseCast, mentioned_profiles: undefined }
    const raw = castToRawTweet(castNoMentions)
    expect(raw.entities?.user_mentions).toEqual([])
  })

  it('handles missing embeds gracefully', () => {
    const castNoEmbeds: NeynarCast = { ...baseCast, embeds: undefined }
    const raw = castToRawTweet(castNoEmbeds)
    expect(raw.entities?.urls).toEqual([])
  })

  it('handles missing bio gracefully', () => {
    const castNoBio: NeynarCast = {
      ...baseCast,
      author: { ...baseCast.author, profile: undefined },
    }
    const raw = castToRawTweet(castNoBio)
    expect(raw.author.description).toBeUndefined()
  })

  it('hashtags array is empty (Farcaster has no native hashtag entities)', () => {
    const raw = castToRawTweet(baseCast)
    expect(raw.entities?.hashtags).toEqual([])
  })
})
