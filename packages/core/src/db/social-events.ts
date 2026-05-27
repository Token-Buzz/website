import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { socialEventKey } from './keys'
import type { SocialEvent, SocialEventType } from '../social-events'

const ALL_TYPES: SocialEventType[] = ['SOCIAL_SPIKE', 'KOL_POST', 'SENTIMENT_SPIKE']

/** Zero-pads a unix-seconds timestamp to 11 digits — matches socialEventKey. */
function padTs(ts: number): string {
  return ts.toString().padStart(11, '0')
}

/**
 * Writes a social event to the Aggregates table via PutCommand.
 * Undefined attributes are stripped by the marshaller.
 */
export async function writeSocialEvent(ev: SocialEvent, id?: string): Promise<void> {
  const keys = socialEventKey(ev.symbol, ev.type, ev.ts, id)
  await ddb.send(new PutCommand({
    TableName: TableNames.aggregates,
    Item: {
      ...keys,
      type: ev.type,
      symbol: ev.symbol.toUpperCase(),
      ts: ev.ts,
      marker: ev.marker,
      title: ev.title,
      ...(ev.magnitude !== undefined && { magnitude: ev.magnitude }),
      ...(ev.direction !== undefined && { direction: ev.direction }),
      ...(ev.tweets !== undefined && { tweets: ev.tweets }),
    },
  }))
}

/**
 * Reads social events from the Aggregates table for a given symbol, filtered
 * by type and time range. Queries each requested type in parallel, merges
 * results, and returns them sorted ascending by ts.
 */
export async function readSocialEvents(opts: {
  symbol: string
  types?: SocialEventType[]
  from: number           // unix seconds inclusive
  to: number             // unix seconds inclusive
  limitPerType?: number  // default 200
}): Promise<SocialEvent[]> {
  const { symbol, types = ALL_TYPES, from, to, limitPerType = 200 } = opts
  const sym = symbol.toUpperCase()

  const queries = types.map(async (type) => {
    const pk = `AGG#${type}#${sym}`
    const skFrom = `EVT#${padTs(from)}`
    // '~' sorts after any printable character in UTF-8, covering the optional #id suffix.
    const skTo = `EVT#${padTs(to)}~`

    const { Items = [] } = await ddb.send(new QueryCommand({
      TableName: TableNames.aggregates,
      KeyConditionExpression: 'pk = :pk AND sk BETWEEN :from AND :to',
      ExpressionAttributeValues: {
        ':pk': pk,
        ':from': skFrom,
        ':to': skTo,
      },
      ScanIndexForward: true, // ascending by sk → ascending by ts
      Limit: limitPerType,
    }))

    return (Items as Array<Record<string, unknown>>).map((item): SocialEvent => ({
      type: item['type'] as SocialEventType,
      symbol: item['symbol'] as string,
      ts: item['ts'] as number,
      marker: item['marker'] as SocialEvent['marker'],
      title: item['title'] as string,
      ...(item['magnitude'] !== undefined && { magnitude: item['magnitude'] as number }),
      ...(item['direction'] !== undefined && { direction: item['direction'] as SocialEvent['direction'] }),
      ...(item['tweets'] !== undefined && { tweets: item['tweets'] as SocialEvent['tweets'] }),
    }))
  })

  const results = await Promise.all(queries)
  return results
    .flat()
    .sort((a, b) => a.ts - b.ts)
}
