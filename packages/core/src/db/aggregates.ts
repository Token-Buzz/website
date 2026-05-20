import { QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { bucketRange } from './keys'

// ── Phase 3 read helpers ─────────────────────────────────────────────────────

/**
 * Top-K aggregate reader for counter-type rollups.
 * Queries all BUCKET rows for a given type+query within [from, to] (ISO hour
 * strings), merges counts by value across all hour buckets, and returns the
 * top-k entries sorted descending by count.
 *
 * Covers: HASHTAG, MENTION, DOMAIN, BIO_DOMAIN, LANG, SOURCE, VERIFICATION,
 *         BOT, HEATMAP, KEYWORD, AUTHOR_INFLUENCE, SENTIMENT_BY_QUERY
 */
export async function readAggregateTopK(opts: {
  type:
    | 'HASHTAG'
    | 'MENTION'
    | 'DOMAIN'
    | 'BIO_DOMAIN'
    | 'LANG'
    | 'SOURCE'
    | 'VERIFICATION'
    | 'BOT'
    | 'HEATMAP'
    | 'KEYWORD'
    | 'AUTHOR_INFLUENCE'
    | 'SENTIMENT_BY_QUERY'
  query: string
  from: string // ISO hour, e.g. "2026-05-17T14:00:00.000Z"
  to: string   // ISO hour, e.g. "2026-05-18T14:00:00.000Z"
  k?: number   // default 10
}): Promise<Array<{ value: string; count: number }>> {
  const { type, query, from, to, k = 10 } = opts
  const pk = `AGG#${type}#${query}`

  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':from': `BUCKET#${from}`,
      ':to': `BUCKET#${to}~`,  // ~ sorts after any char in UTF-8, covers all values
    },
  }))

  // Merge counts across hour buckets keyed by the value portion of sk
  // sk format: BUCKET#<hour>#<value>
  const totals = new Map<string, number>()
  for (const item of Items as Array<{ sk: string; count?: number }>) {
    const parts = item.sk.split('#')
    // BUCKET # <hour> # <value> — value may itself contain #
    if (parts.length < 3) continue
    const value = parts.slice(2).join('#')
    totals.set(value, (totals.get(value) ?? 0) + (item.count ?? 0))
  }

  return Array.from(totals.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, k)
}

/**
 * Engagement time-series reader.
 * Returns per-hour buckets of summed likes/retweets/replies/quotes, ordered
 * ascending by bucket timestamp — suitable for charting over a time window.
 *
 * sk format: BUCKET#<hour>#engagement
 */
export async function readEngagementBuckets(opts: {
  query: string
  from: string // ISO hour
  to: string   // ISO hour
}): Promise<Array<{ bucket: string; likes: number; retweets: number; replies: number; quotes: number }>> {
  const { query, from, to } = opts
  const pk = `AGG#ENGAGEMENT#${query}`

  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.aggregates,
    KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
    ExpressionAttributeValues: {
      ':pk': pk,
      ':from': `BUCKET#${from}#engagement`,
      ':to': `BUCKET#${to}#engagement`,
    },
    ScanIndexForward: true, // ascending by sk → ascending by time
  }))

  return (Items as Array<{
    sk: string
    likes?: number
    retweets?: number
    replies?: number
    quotes?: number
  }>).map((item) => {
    const parts = item.sk.split('#')
    // BUCKET # <hour> # engagement — hour is parts[1]
    const bucket = parts[1] ?? ''
    return {
      bucket,
      likes: item.likes ?? 0,
      retweets: item.retweets ?? 0,
      replies: item.replies ?? 0,
      quotes: item.quotes ?? 0,
    }
  })
}

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

export async function incrementSentimentByQuery(
  query: string,
  hourBucket: string,
  sentiment: 'bull' | 'bear' | 'neu' | 'positive' | 'negative' | 'neutral',
): Promise<void> {
  const label =
    sentiment === 'bull' || sentiment === 'positive'
      ? 'positive'
      : sentiment === 'bear' || sentiment === 'negative'
        ? 'negative'
        : 'neutral'
  await ddb.send(new UpdateCommand({
    TableName: TableNames.aggregates,
    Key: {
      pk: `AGG#SENTIMENT_BY_QUERY#${query}`,
      sk: `BUCKET#${hourBucket}#${label}`,
    },
    UpdateExpression: 'ADD #c :one',
    ExpressionAttributeNames: { '#c': 'count' },
    ExpressionAttributeValues: { ':one': 1 },
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
