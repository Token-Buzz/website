import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'

export interface Tweet {
  tweetId: string
  query: string
  text: string
  authorUsername: string
  authorId: string
  authorName: string
  authorFollowers: number
  authorProfilePicture?: string
  createdAt: string
  likeCount: number
  retweetCount: number
  replyCount: number
  quoteCount: number
  viewCount: number
  bookmarkCount: number
  lang: string
  isReply: boolean
  hashtags: string[]
  mentions: string[]
  urls: string[]
  // ── Analytics extension fields (all optional; populated at ingest time) ────
  conversationId?: string
  inReplyToId?: string
  authorCreatedAt?: string
  authorBioUrls?: string[]
  authorIsBlueVerified?: boolean
  authorVerifiedType?: string
  authorIsAutomated?: boolean
  authorLocationRaw?: string
  authorLocationNormalized?: { country?: string; lat?: number; lng?: number }
  botScore?: number
  keywords?: string[]
}

export interface TweetRecord {
  pk: string
  sk: string
  id: string
  handle: string
  text: string
  timestamp: string
  sent: 'bull' | 'bear' | 'neu'
  symbol: string
  followers: number
  likes: number
  retweets: number
  replies: number
  gsi1pk?: string
  gsi1sk?: string
  gsi2pk?: string
  gsi2sk?: string
  gsi3pk?: string
  gsi3sk?: string
  // ── Analytics extension fields (all optional; populated at ingest time) ────
  conversationId?: string
  inReplyToId?: string
  authorCreatedAt?: string
  authorBioUrls?: string[]
  authorIsBlueVerified?: boolean
  authorVerifiedType?: string
  authorIsAutomated?: boolean
  authorLocationRaw?: string
  authorLocationNormalized?: { country?: string; lat?: number; lng?: number }
  botScore?: number
  keywords?: string[]
}

export async function getTweet(id: string): Promise<TweetRecord | null> {
  const { Item } = await ddb.send(new GetCommand({
    TableName: TableNames.tweets,
    Key: { pk: `TWEET#${id}`, sk: `TWEET#${id}` },
  }))
  return (Item as TweetRecord) ?? null
}

export async function getTweetsByQuery(
  query: string,
  opts: { limit?: number; cursor?: string } = {},
): Promise<{ items: TweetRecord[]; cursor?: string }> {
  const { Items = [], LastEvaluatedKey } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'QueryByQueryTime',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `QUERY#${query}` },
    Limit: opts.limit ?? 50,
    ScanIndexForward: false,
    ExclusiveStartKey: opts.cursor ? JSON.parse(Buffer.from(opts.cursor, 'base64').toString()) : undefined,
  }))
  return {
    items: Items as TweetRecord[],
    cursor: LastEvaluatedKey ? Buffer.from(JSON.stringify(LastEvaluatedKey)).toString('base64') : undefined,
  }
}

const WINDOW_MS: Record<'1H' | '4H' | '24H' | '7D', number> = {
  '1H':  1 * 60 * 60 * 1000,
  '4H':  4 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D':  7 * 24 * 60 * 60 * 1000,
}

// Time-windowed live scan for analytics endpoints that can't roll up cleanly.
// Uses the QueryByQueryTime GSI with gsi1sk BETWEEN <from> AND <to>.
// Returns up to `cap` items (default 2000) and a truncated flag.
export async function getTweetsByQueryWindow(
  query: string,
  opts: { window: '1H' | '4H' | '24H' | '7D'; cap?: number },
): Promise<{ items: TweetRecord[]; truncated: boolean }> {
  const cap = opts.cap ?? 2000
  const now = new Date()
  const from = new Date(now.getTime() - WINDOW_MS[opts.window]).toISOString()
  const to = now.toISOString()

  const collected: TweetRecord[] = []
  let lastKey: Record<string, unknown> | undefined

  do {
    const { Items = [], LastEvaluatedKey } = await ddb.send(new QueryCommand({
      TableName: TableNames.tweets,
      IndexName: 'QueryByQueryTime',
      KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': `QUERY#${query}`,
        ':from': from,
        ':to': to,
      },
      ScanIndexForward: false,
      Limit: Math.min(cap - collected.length + 1, 100),
      ExclusiveStartKey: lastKey,
    }))
    collected.push(...(Items as TweetRecord[]))
    lastKey = LastEvaluatedKey as Record<string, unknown> | undefined

    if (collected.length > cap) {
      return { items: collected.slice(0, cap), truncated: true }
    }
  } while (lastKey)

  return { items: collected, truncated: false }
}

export async function getTweetsByAuthor(
  handle: string,
  opts: { limit?: number } = {},
): Promise<TweetRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'QueryByAuthor',
    KeyConditionExpression: 'gsi2pk = :pk',
    ExpressionAttributeValues: { ':pk': `AUTHOR#${handle.replace('@', '')}` },
    Limit: opts.limit ?? 50,
    ScanIndexForward: false,
  }))
  return Items as TweetRecord[]
}

export async function getTweetsByConversation(conversationId: string): Promise<TweetRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'ByConversation',
    KeyConditionExpression: 'gsi3pk = :pk',
    ExpressionAttributeValues: { ':pk': `CONV#${conversationId}` },
    ScanIndexForward: true,
  }))
  return Items as TweetRecord[]
}

export async function putTweet(tweet: Tweet): Promise<void> {
  const timestamp = new Date(tweet.createdAt).toISOString()
  const pk = `QUERY#${tweet.query}`
  const sk = `${timestamp}#${tweet.tweetId}`

  await ddb.send(new PutCommand({
    TableName: TableNames.tweets,
    Item: {
      pk,
      sk,
      tweetId: tweet.tweetId,
      query: tweet.query,
      text: tweet.text,
      authorUsername: tweet.authorUsername,
      authorId: tweet.authorId,
      authorName: tweet.authorName,
      authorFollowers: tweet.authorFollowers,
      authorProfilePicture: tweet.authorProfilePicture,
      createdAt: tweet.createdAt,
      likeCount: tweet.likeCount,
      retweetCount: tweet.retweetCount,
      replyCount: tweet.replyCount,
      quoteCount: tweet.quoteCount,
      viewCount: tweet.viewCount,
      bookmarkCount: tweet.bookmarkCount,
      lang: tweet.lang,
      isReply: tweet.isReply,
      hashtags: tweet.hashtags,
      mentions: tweet.mentions,
      urls: tweet.urls,
      gsi1pk: `QUERY#${tweet.query}`,
      gsi1sk: `${timestamp}#${tweet.tweetId}`,
      gsi2pk: `AUTHOR#${tweet.authorUsername}`,
      gsi2sk: timestamp,
      // Analytics extension fields (undefined values are stripped by ddb marshaller)
      conversationId: tweet.conversationId,
      inReplyToId: tweet.inReplyToId,
      authorCreatedAt: tweet.authorCreatedAt,
      authorBioUrls: tweet.authorBioUrls,
      authorIsBlueVerified: tweet.authorIsBlueVerified,
      authorVerifiedType: tweet.authorVerifiedType,
      authorIsAutomated: tweet.authorIsAutomated,
      authorLocationRaw: tweet.authorLocationRaw,
      authorLocationNormalized: tweet.authorLocationNormalized,
      botScore: tweet.botScore,
      keywords: tweet.keywords,
    },
  }))
}

export async function getRecentTweetsByQuery(
  query: string,
  opts: { before?: string; limit?: number } = {},
): Promise<TweetRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'QueryByQueryTime',
    KeyConditionExpression: opts.before
      ? 'gsi1pk = :pk AND gsi1sk < :before'
      : 'gsi1pk = :pk',
    ExpressionAttributeValues: opts.before
      ? { ':pk': `QUERY#${query}`, ':before': opts.before }
      : { ':pk': `QUERY#${query}` },
    ScanIndexForward: false,
    Limit: opts.limit ?? 30,
  }))
  return Items as TweetRecord[]
}

export async function getLatestTweetId(query: string): Promise<string | null> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'QueryByQueryTime',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `QUERY#${query}` },
    ScanIndexForward: false,
    Limit: 1,
  }))
  return Items.length > 0 ? (Items[0] as any)?.tweetId : null
}

export async function updateTweetSentiment(
  tweetId: string,
  query: string,
  sentiment: 'bull' | 'bear' | 'neu',
  score: number,
): Promise<void> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.tweets,
    IndexName: 'QueryByQueryTime',
    KeyConditionExpression: 'gsi1pk = :pk',
    FilterExpression: 'tweetId = :tid',
    ExpressionAttributeValues: { ':pk': `QUERY#${query}`, ':tid': tweetId },
  }))

  if (Items.length === 0) return

  const item = Items[0] as any
  await ddb.send(new UpdateCommand({
    TableName: TableNames.tweets,
    Key: { pk: item.pk, sk: item.sk },
    UpdateExpression: 'SET sentiment = :sent, sentimentScore = :score',
    ExpressionAttributeValues: {
      ':sent': sentiment,
      ':score': score,
    },
  }))
}
