/**
 * Seed DynamoDB tables with fixture data for local development.
 *
 * Usage (requires sst dev to be running in another terminal):
 *   sst shell tsx scripts/seed-dev-data.ts
 *
 * Or add to package.json scripts:
 *   "seed": "sst shell tsx scripts/seed-dev-data.ts"
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { BatchWriteCommand, DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Resource } from 'sst'

const raw = new DynamoDBClient({})
const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
})

const tables = {
  tweets:     Resource.Tweets.name,
  aggregates: Resource.Aggregates.name,
  tokens:     Resource.Tokens.name,
  userData:   Resource.UserData.name,
}

async function batchWrite(tableName: string, items: Record<string, unknown>[]) {
  const chunks: Record<string, unknown>[][] = []
  for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25))
  for (const chunk of chunks) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: chunk.map((Item) => ({ PutRequest: { Item } })),
      },
    }))
  }
}

// ── Token records ───────────────────────────────────────────────────────────

const TOKENS = [
  { sym: 'PEPE',  name: 'Pepe',      price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
  { sym: 'MOG',   name: 'Mog Coin',  price: 0.00000176,d24: 41.20, mentions:  6700, dbuzz: 218, sent: 'bull', spark: [2,3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true },
  { sym: 'SOL',   name: 'Solana',    price: 182.40,    d24: -2.31, mentions: 12400, dbuzz: -18, sent: 'bear', spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
  { sym: 'BONK',  name: 'Bonk',      price: 0.000033,  d24: -4.62, mentions: 22700, dbuzz:   7, sent: 'neu',  spark: [12,13,12,11,12,11,11,10,11,10,10,11,10,9,10] },
  { sym: 'WIF',   name: 'dogwifhat', price: 2.41,      d24: 12.40, mentions:  9800, dbuzz:  84, sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16] },
  { sym: 'BRETT', name: 'Brett',     price: 0.092,     d24: -1.18, mentions:  4400, dbuzz:  22, sent: 'neu',  spark: [10,11,11,10,11,11,12,11,12,12,11,12,12,12,11] },
  { sym: 'TURBO', name: 'Turbo',     price: 0.0041,    d24:  8.07, mentions:  3100, dbuzz:  96, sent: 'bull', spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true },
  { sym: 'DOGE',  name: 'Dogecoin',  price: 0.171,     d24:  0.42, mentions: 18900, dbuzz:  -4, sent: 'neu',  spark: [12,12,11,12,12,12,11,12,12,12,11,12,12,12,12] },
] as const

async function seedTokens() {
  const now = new Date().toISOString()
  const items = TOKENS.map((t) => ({
    pk: `TOKEN#${t.sym}`,
    sk: 'META',
    ...t,
    updatedAt: now,
    // SpikingByDelta GSI — only for tokens with positive dbuzz
    ...(t.dbuzz > 0 ? {
      gsi1pk: 'SPIKE',
      gsi1sk: `${t.dbuzz.toString().padStart(10, '0')}#${t.sym}`,
    } : {}),
    // WatchlistByMentions GSI — 'TRACKED' synthetic partition key lists all tracked tokens
    gsi2pk: 'TRACKED',
    gsi2sk: `${t.mentions.toString().padStart(10, '0')}#${t.sym}`,
  }))
  await batchWrite(tables.tokens, items)
  console.log(`  ✓ Tokens: ${items.length} records`)
}

// ── Tweet records ───────────────────────────────────────────────────────────

const TWEETS = [
  { id: 'tw1', handle: 'cobie',       followers: 812000,   time: '2m',  sent: 'bull', text: 'watching $PEPE accumulate again. four wallets I tagged in march are buying. not advice, just pattern.', tick: 'PEPE' },
  { id: 'tw2', handle: 'hsaka',       followers: 210000,   time: '4m',  sent: 'bull', text: "$MOG volume profile is the cleanest setup I've seen since the last cycle. fwiw.",                         tick: 'MOG' },
  { id: 'tw3', handle: 'aeyakovenko', followers: 440000,   time: '9m',  sent: 'neu',  text: 'fees on solana for memecoin wrappers spiking again. interesting.',                                       tick: 'SOL' },
  { id: 'tw4', handle: 'CryptoKaleo', followers: 1200000,  time: '11m', sent: 'neu',  text: 'memecoin rotation feels stalled. $PEPE getting all the mindshare but the others are quiet.',             tick: 'PEPE' },
  { id: 'tw5', handle: 'degenspartan',followers: 320000,   time: '16m', sent: 'bear', text: 'every degen is long $PEPE rn. someone has to be wrong.',                                                  tick: 'PEPE' },
  { id: 'tw6', handle: 'hosseeb',     followers: 168000,   time: '22m', sent: 'bull', text: '$MOG is one of those names where the buyers are louder than the chart suggests.',                          tick: 'MOG' },
  { id: 'tw7', handle: 'gainzy222',   followers:  98000,   time: '28m', sent: 'bull', text: 'i still think $PEPE 2x from here before the cycle ends',                                                   tick: 'PEPE' },
]

async function seedTweets() {
  const now = Date.now()
  const items = TWEETS.map((t, i) => {
    const ts = new Date(now - i * 120_000).toISOString()
    return {
      pk: `TWEET#${t.id}`,
      sk: `TWEET#${t.id}`,
      ...t,
      timestamp: ts,
      likes: Math.floor(Math.random() * 2000),
      retweets: Math.floor(Math.random() * 500),
      replies: Math.floor(Math.random() * 200),
      // QueryByQueryTime GSI — query = 'all' for global feed
      gsi1pk: 'QUERY#all',
      gsi1sk: `${ts}#${t.id}`,
      // QueryByAuthor GSI
      gsi2pk: `AUTHOR#${t.handle}`,
      gsi2sk: `${ts}#${t.id}`,
    }
  })
  await batchWrite(tables.tweets, items)
  console.log(`  ✓ Tweets: ${items.length} records`)
}

// ── Aggregate records ───────────────────────────────────────────────────────

async function seedAggregates() {
  const now = Date.now()
  const items: Record<string, unknown>[] = []

  // Pulse: 60 one-minute buckets for the last hour
  const PULSE = [
    84,86,88,85,90,92,88,94,99,102,106,110,118,122,130,142,156,168,174,182,
    190,188,192,198,204,212,218,224,226,232,238,244,250,256,252,248,244,252,
    264,272,280,288,298,304,312,308,314,322,328,336,342,348,354,358,362,366,
    370,376,382,388,
  ]
  PULSE.forEach((count, i) => {
    const ts = new Date(now - (59 - i) * 60_000)
    const bucket = `${ts.toISOString().slice(0, 16)}:00Z`
    items.push({
      pk: 'AGG#PULSE#all',
      sk: `BUCKET#${bucket}`,
      type: 'PULSE', scope: 'all', bucket, count,
      gsi1pk: 'TYPE#PULSE#all',
      gsi1sk: `${count.toString().padStart(10, '0')}#${bucket}`,
    })
  })

  // Sentiment: 24 one-hour buckets for the last 24h
  const SENTIMENT_HOURS = [
    { bull: 58, neu: 22, bear: 20 }, { bull: 55, neu: 24, bear: 21 },
    { bull: 52, neu: 26, bear: 22 }, { bull: 57, neu: 23, bear: 20 },
    { bull: 63, neu: 20, bear: 17 }, { bull: 68, neu: 18, bear: 14 },
    { bull: 65, neu: 19, bear: 16 }, { bull: 61, neu: 21, bear: 18 },
    { bull: 66, neu: 19, bear: 15 }, { bull: 70, neu: 17, bear: 13 },
    { bull: 67, neu: 18, bear: 15 }, { bull: 62, neu: 20, bear: 18 },
    { bull: 64, neu: 19, bear: 17 }, { bull: 59, neu: 23, bear: 18 },
    { bull: 61, neu: 20, bear: 19 }, { bull: 65, neu: 18, bear: 17 },
    { bull: 68, neu: 17, bear: 15 }, { bull: 63, neu: 20, bear: 17 },
    { bull: 66, neu: 18, bear: 16 }, { bull: 70, neu: 16, bear: 14 },
    { bull: 68, neu: 17, bear: 15 }, { bull: 64, neu: 19, bear: 17 },
    { bull: 63, neu: 20, bear: 17 }, { bull: 65, neu: 19, bear: 16 },
  ]
  SENTIMENT_HOURS.forEach((s, i) => {
    const ts = new Date(now - (23 - i) * 3_600_000)
    const bucket = `${ts.toISOString().slice(0, 13)}:00:00Z`
    items.push({
      pk: 'AGG#SENTIMENT#all',
      sk: `BUCKET#${bucket}`,
      type: 'SENTIMENT', scope: 'all', bucket,
      count: s.bull + s.neu + s.bear,
      bull: s.bull, neu: s.neu, bear: s.bear,
      score: s.bull - s.bear,
    })
  })

  // Hashtags: top-K entries in aggregates table via TopK GSI
  const HASHTAGS = [
    { tag: '#pepe', count: 18420 }, { tag: '#mog', count: 12840 },
    { tag: '#solana', count: 9140 }, { tag: '#crypto', count: 8720 },
    { tag: '#bonk', count: 7600 },  { tag: '#ai', count: 6480 },
    { tag: '#defi', count: 5240 },  { tag: '#wif', count: 4820 },
    { tag: '#eth', count: 4200 },   { tag: '#turbo', count: 3640 },
  ]
  HASHTAGS.forEach(({ tag, count }) => {
    items.push({
      pk: `AGG#HASHTAG#all`,
      sk: `TAG#${tag}`,
      type: 'HASHTAG', scope: 'all', bucket: 'current',
      tag, count,
      gsi1pk: 'TYPE#HASHTAG#all',
      gsi1sk: `${count.toString().padStart(10, '0')}#${tag}`,
    })
  })

  await batchWrite(tables.aggregates, items)
  console.log(`  ✓ Aggregates: ${items.length} records (pulse, sentiment, hashtags)`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding TokenBuzz dev data...\n')
  await seedTokens()
  await seedTweets()
  await seedAggregates()
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
