import { QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
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

export async function incrementPulse(query: string, minuteBucket: string): Promise<void> {
  const pk = `PULSE#${query}`
  const sk = `BUCKET#${minuteBucket}`

  await ddb.send(new UpdateCommand({
    TableName: TableNames.aggregates,
    Key: { pk, sk },
    UpdateExpression: 'ADD #count :inc SET #type = :type, #scope = :scope, #bucket = :bucket',
    ExpressionAttributeNames: {
      '#count': 'count',
      '#type': 'type',
      '#scope': 'scope',
      '#bucket': 'bucket',
    },
    ExpressionAttributeValues: {
      ':inc': 1,
      ':type': 'PULSE',
      ':scope': query,
      ':bucket': minuteBucket,
    },
  }))
}

export async function incrementHourlyHashtags(
  query: string,
  hourBucket: string,
  hashtags: string[],
): Promise<void> {
  for (const hashtag of hashtags) {
    const pk = `AGG#HASHTAG#${query}`
    const sk = `BUCKET#${hourBucket}#${hashtag}`

    await ddb.send(new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: { pk, sk },
      UpdateExpression: 'ADD #count :inc SET #type = :type, #scope = :scope, #bucket = :bucket, #tag = :tag',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#type': 'type',
        '#scope': 'scope',
        '#bucket': 'bucket',
        '#tag': 'hashtag',
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':type': 'HASHTAG',
        ':scope': query,
        ':bucket': hourBucket,
        ':tag': hashtag,
      },
    }))
  }
}

export async function incrementHourlyMentions(
  query: string,
  hourBucket: string,
  mentions: string[],
): Promise<void> {
  for (const mention of mentions) {
    const pk = `AGG#MENTION#${query}`
    const sk = `BUCKET#${hourBucket}#${mention}`

    await ddb.send(new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: { pk, sk },
      UpdateExpression: 'ADD #count :inc SET #type = :type, #scope = :scope, #bucket = :bucket, #user = :user',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#type': 'type',
        '#scope': 'scope',
        '#bucket': 'bucket',
        '#user': 'mention',
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':type': 'MENTION',
        ':scope': query,
        ':bucket': hourBucket,
        ':user': mention,
      },
    }))
  }
}

export async function incrementHourlyDomains(
  query: string,
  hourBucket: string,
  domains: string[],
): Promise<void> {
  for (const domain of domains) {
    const pk = `AGG#DOMAIN#${query}`
    const sk = `BUCKET#${hourBucket}#${domain}`

    await ddb.send(new UpdateCommand({
      TableName: TableNames.aggregates,
      Key: { pk, sk },
      UpdateExpression: 'ADD #count :inc SET #type = :type, #scope = :scope, #bucket = :bucket, #domain = :domain',
      ExpressionAttributeNames: {
        '#count': 'count',
        '#type': 'type',
        '#scope': 'scope',
        '#bucket': 'bucket',
        '#domain': 'domain',
      },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':type': 'DOMAIN',
        ':scope': query,
        ':bucket': hourBucket,
        ':domain': domain,
      },
    }))
  }
}

export async function incrementHourlySentiment(
  query: string,
  hourBucket: string,
  sentiment: 'bull' | 'bear' | 'neu',
  score: number,
): Promise<void> {
  const pk = `AGG#SENTIMENT#${query}`
  const sk = `BUCKET#${hourBucket}`
  const sentimentCount = sentiment === 'bull' ? 'bullCount' : sentiment === 'bear' ? 'bearCount' : 'neutralCount'

  await ddb.send(new UpdateCommand({
    TableName: TableNames.aggregates,
    Key: { pk, sk },
    UpdateExpression: `ADD #count :inc, #sent :sentInc, #score :scoreInc SET #type = :type, #scope = :scope, #bucket = :bucket, #${sentimentCount} = if_not_exists(#${sentimentCount}, :zero) + :sentInc`,
    ExpressionAttributeNames: {
      '#count': 'tweetCount',
      '#type': 'type',
      '#scope': 'scope',
      '#bucket': 'bucket',
      '#sent': sentiment,
      '#score': 'totalScore',
      [`#${sentimentCount}`]: sentimentCount,
    },
    ExpressionAttributeValues: {
      ':inc': 1,
      ':sentInc': 1,
      ':scoreInc': score,
      ':type': 'SENTIMENT',
      ':scope': query,
      ':bucket': hourBucket,
      ':zero': 0,
    },
  }))
}

export async function writeDailyRollup(
  symbol: string,
  dayBucket: string,
  data: {
    bullCount: number
    neutralCount: number
    bearCount: number
    totalScore: number
    tweetCount: number
    avgScore: number
    hourlyCount: number
  },
): Promise<void> {
  const pk = `ROLLUP#${symbol}`
  const sk = `DAY#${dayBucket}`

  await ddb.send(new PutCommand({
    TableName: TableNames.aggregates,
    Item: {
      pk,
      sk,
      type: 'DAILY_ROLLUP',
      scope: symbol,
      bucket: dayBucket,
      ...data,
    },
  }))
}
