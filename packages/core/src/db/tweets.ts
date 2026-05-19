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
      gsi1sk: timestamp,
      gsi2pk: `AUTHOR#${tweet.authorUsername}`,
      gsi2sk: timestamp,
    },
  }))
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
