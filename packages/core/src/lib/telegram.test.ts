import { describe, it, test, expect, beforeEach, afterEach } from 'vitest'
import {
  messageToRawTweet,
  searchMessages,
  TelegramApiError,
  RETRY_DELAYS_MS,
  __setSleep,
  __setClientFactory,
  __resetClientFactory,
  type TelegramMessage,
  type TgClient,
} from './telegram'

// ── messageToRawTweet (pure mapper) ────────────────────────────────────────────

const baseMsg: TelegramMessage = {
  id: 42,
  channel: 'binance',
  channelTitle: 'Binance Announcements',
  text: 'BTC just hit a new high',
  date: 1_700_000_000, // unix seconds
  views: 1234,
  forwards: 56,
  replies: 7,
  senderId: '99',
  senderUsername: 'satoshi',
  senderName: 'Satoshi N',
}

describe('messageToRawTweet', () => {
  it('composes id as `${channel}:${id}` (unique across channels)', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.id).toBe('binance:42')
  })

  it('maps text', () => {
    expect(messageToRawTweet(baseMsg).text).toBe('BTC just hit a new high')
  })

  it('maps unix-seconds date to ISO createdAt', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.createdAt).toBe(new Date(1_700_000_000 * 1000).toISOString())
  })

  it('maps forwards → retweetCount, views → viewCount, replies → replyCount', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.retweetCount).toBe(56)
    expect(raw.viewCount).toBe(1234)
    expect(raw.replyCount).toBe(7)
  })

  it('sets likeCount/quoteCount/bookmarkCount to 0, lang en, isReply false', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.likeCount).toBe(0)
    expect(raw.quoteCount).toBe(0)
    expect(raw.bookmarkCount).toBe(0)
    expect(raw.lang).toBe('en')
    expect(raw.isReply).toBe(false)
  })

  it('maps sender fields onto the author when present', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.author.userName).toBe('satoshi')
    expect(raw.author.id).toBe('99')
    expect(raw.author.name).toBe('Satoshi N')
    expect(raw.author.isBlueVerified).toBe(false)
    expect(raw.author.followers).toBe(0)
    expect(raw.author.following).toBe(0)
    expect(raw.author.statusesCount).toBe(0)
  })

  it('falls back to channel for author fields when sender info is missing', () => {
    const raw = messageToRawTweet({
      id: 1,
      channel: 'whale_alert_io',
      text: 'A whale moved 1000 BTC',
      date: 1_700_000_000,
      views: 0,
      forwards: 0,
      replies: 0,
    })
    expect(raw.author.userName).toBe('whale_alert_io')
    expect(raw.author.id).toBe('whale_alert_io')
    // name falls back to channelTitle then channel
    expect(raw.author.name).toBe('whale_alert_io')
  })

  it('uses channelTitle as the author name fallback when senderName is missing', () => {
    const raw = messageToRawTweet({
      id: 1,
      channel: 'whale_alert_io',
      channelTitle: 'Whale Alert',
      text: 'A whale moved 1000 BTC',
      date: 1_700_000_000,
      views: 0,
      forwards: 0,
      replies: 0,
    })
    expect(raw.author.name).toBe('Whale Alert')
  })

  it('emits empty entity arrays', () => {
    const raw = messageToRawTweet(baseMsg)
    expect(raw.entities).toEqual({ hashtags: [], user_mentions: [], urls: [] })
  })
})

describe('TelegramApiError', () => {
  it('carries a status and name', () => {
    const err = new TelegramApiError('boom', 500)
    expect(err.name).toBe('TelegramApiError')
    expect(err.status).toBe(500)
    expect(err).toBeInstanceOf(Error)
  })

  it('optionally carries floodWaitSeconds', () => {
    const err = new TelegramApiError('flood', 429, 30)
    expect(err.floodWaitSeconds).toBe(30)
  })
})

// ── searchMessages ──────────────────────────────────────────────────────────────

// A GramJS-shaped raw message (loosely typed in real life).
function gramMessage(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 100,
    message: 'a crypto message',
    date: 1_700_000_000,
    views: 10,
    forwards: 2,
    replies: { replies: 3 },
    senderId: 555,
    sender: { username: 'alice', firstName: 'Alice', lastName: 'Smith' },
    ...over,
  }
}

describe('searchMessages', () => {
  let restoreSleep: (ms: number) => Promise<void>
  let originalDelays: number[]

  beforeEach(() => {
    process.env.TELEGRAM_API_ID = '12345'
    process.env.TELEGRAM_API_HASH = 'abc-hash'
    process.env.TELEGRAM_SESSION = 'sess-string'
    originalDelays = [...RETRY_DELAYS_MS]
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, 0, 0)
    restoreSleep = __setSleep(async () => {})
  })

  afterEach(() => {
    RETRY_DELAYS_MS.splice(0, RETRY_DELAYS_MS.length, ...originalDelays)
    __setSleep(restoreSleep)
    __resetClientFactory()
    delete process.env.TELEGRAM_API_ID
    delete process.env.TELEGRAM_API_HASH
    delete process.env.TELEGRAM_SESSION
  })

  it('throws TelegramApiError(500) when env credentials are missing', async () => {
    delete process.env.TELEGRAM_SESSION
    await expect(searchMessages('btc')).rejects.toMatchObject({
      name: 'TelegramApiError',
      status: 500,
    })
  })

  it('aggregates messages across channels and maps GramJS fields', async () => {
    const calls: string[] = []
    const fakeClient: TgClient = {
      async getMessages(channel) {
        calls.push(channel)
        return [gramMessage({ id: 1 }), gramMessage({ id: 2 })]
      },
    }
    __setClientFactory(async () => fakeClient)

    const messages = await searchMessages('btc', {
      channels: ['binance', 'cointelegraph'],
      perChannelLimit: 5,
    })

    // 2 channels × 2 messages each
    expect(calls).toEqual(['binance', 'cointelegraph'])
    expect(messages).toHaveLength(4)

    const first = messages[0]
    expect(first.channel).toBe('binance')
    expect(first.text).toBe('a crypto message')
    expect(first.date).toBe(1_700_000_000)
    expect(first.views).toBe(10)
    expect(first.forwards).toBe(2)
    expect(first.replies).toBe(3)
    expect(first.senderId).toBe('555')
    expect(first.senderUsername).toBe('alice')
    expect(first.senderName).toBe('Alice Smith')
  })

  it('skips messages with empty/undefined text', async () => {
    const fakeClient: TgClient = {
      async getMessages() {
        return [
          gramMessage({ id: 1, message: '' }),
          gramMessage({ id: 2, message: undefined, text: undefined }),
          gramMessage({ id: 3, message: 'keep me' }),
        ]
      },
    }
    __setClientFactory(async () => fakeClient)

    const messages = await searchMessages('btc', { channels: ['binance'] })
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe(3)
  })

  it('applies defensive defaults for missing GramJS fields', async () => {
    const fakeClient: TgClient = {
      async getMessages() {
        // Only id + message present; everything else missing.
        return [{ id: 7, message: 'sparse' }]
      },
    }
    __setClientFactory(async () => fakeClient)

    const [m] = await searchMessages('btc', { channels: ['binance'] })
    expect(m.views).toBe(0)
    expect(m.forwards).toBe(0)
    expect(m.replies).toBe(0)
    expect(m.senderId).toBeUndefined()
    expect(m.senderUsername).toBeUndefined()
    expect(m.senderName).toBeUndefined()
  })

  it('retries the channel once on a small FloodWaitError then succeeds', async () => {
    let attempts = 0
    const fakeClient: TgClient = {
      async getMessages() {
        attempts++
        if (attempts === 1) {
          // Simulate GramJS FloodWaitError without importing the real class.
          const err = new Error('flood') as Error & { seconds: number }
          err.name = 'FloodWaitError'
          err.seconds = 5
          throw err
        }
        return [gramMessage({ id: 1 })]
      },
    }
    __setClientFactory(async () => fakeClient)

    const messages = await searchMessages('btc', { channels: ['binance'] })
    expect(attempts).toBe(2)
    expect(messages).toHaveLength(1)
  })

  it('skips the channel (does not throw) on a large FloodWaitError', async () => {
    const fakeClient: TgClient = {
      async getMessages(channel) {
        if (channel === 'binance') {
          const err = new Error('flood') as Error & { seconds: number }
          err.name = 'FloodWaitError'
          err.seconds = 300 // > 60s → skip
          throw err
        }
        return [gramMessage({ id: 9 })]
      },
    }
    __setClientFactory(async () => fakeClient)

    const messages = await searchMessages('btc', {
      channels: ['binance', 'cointelegraph'],
    })
    // binance skipped, cointelegraph still ingested
    expect(messages).toHaveLength(1)
    expect(messages[0].channel).toBe('cointelegraph')
  })

  test('exhausting the retry budget on a generic error throws TelegramApiError', async () => {
    const fakeClient: TgClient = {
      async getMessages() {
        throw new Error('transient network blip')
      },
    }
    __setClientFactory(async () => fakeClient)

    await expect(
      searchMessages('btc', { channels: ['binance'] }),
    ).rejects.toMatchObject({ name: 'TelegramApiError', status: 500 })
  })
})
