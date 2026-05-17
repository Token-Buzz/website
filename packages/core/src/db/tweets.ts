import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'

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
