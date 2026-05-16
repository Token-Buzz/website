import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { bucketRange } from './keys'

export interface AggregateRecord {
  pk: string
  sk: string
  type: string
  scope: string
  bucket: string
  count: number
  score?: number
  bull?: number
  bear?: number
  neu?: number
  topItems?: Array<{ label: string; count: number }>
}

export async function getHashtags(
  scope: string,
  limit = 20,
): Promise<AggregateRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    IndexName: 'TopK',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `TYPE#HASHTAG#${scope}` },
    ScanIndexForward: false,
    Limit: limit,
  }))
  return Items as AggregateRecord[]
}

export async function getMentions(
  scope: string,
  window: '1H' | '4H' | '24H' | '7D' = '24H',
): Promise<AggregateRecord[]> {
  const buckets = bucketRange(window, 'hour')
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `AGG#MENTION#${scope}`,
      ':from': `BUCKET#${buckets[0]}`,
      ':to': `BUCKET#${buckets[buckets.length - 1]}`,
    },
  }))
  return Items as AggregateRecord[]
}

export async function getSentiment(
  scope: string,
  window: '1H' | '4H' | '24H' | '7D' = '24H',
): Promise<AggregateRecord[]> {
  const buckets = bucketRange(window, 'hour')
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': `AGG#SENTIMENT#${scope}`,
      ':from': `BUCKET#${buckets[0]}`,
      ':to': `BUCKET#${buckets[buckets.length - 1]}`,
    },
  }))
  return Items as AggregateRecord[]
}

export async function getPulse(
  window: '1H' | '4H' = '1H',
): Promise<AggregateRecord[]> {
  const buckets = bucketRange(window, 'minute')
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': 'AGG#PULSE#all',
      ':from': `BUCKET#${buckets[0]}`,
      ':to': `BUCKET#${buckets[buckets.length - 1]}`,
    },
  }))
  return Items as AggregateRecord[]
}

export async function getMpm(): Promise<number> {
  const items = await getPulse('1H')
  if (!items.length) return 0
  return Math.round(items.reduce((s, i) => s + (i.count || 0), 0) / items.length)
}

export async function getDomains(
  scope: string,
  window: '1H' | '4H' | '24H' | '7D' = '24H',
): Promise<AggregateRecord[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    IndexName: 'TopK',
    KeyConditionExpression: 'gsi1pk = :pk',
    ExpressionAttributeValues: { ':pk': `TYPE#DOMAIN#${scope}` },
    ScanIndexForward: false,
    Limit: 20,
  }))
  return Items as AggregateRecord[]
}
