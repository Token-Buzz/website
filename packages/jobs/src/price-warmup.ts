import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import { getOHLCV } from '@monorepo-template/core/db/ohlcv'
import { INTERVAL_SECONDS } from '@monorepo-template/core/providers/price'

const TOP_N = 10
const WARMUP_INTERVALS = ['1h', '4h', '1d'] as const

export const handler = async () => {
  // Query top-N tokens by mentions (WatchlistByMentions GSI, scan DESC)
  const res = await ddb.send(
    new QueryCommand({
      TableName: TableNames.tokens,
      IndexName: 'WatchlistByMentions',
      KeyConditionExpression: 'gsi2pk = :pk',
      ExpressionAttributeValues: { ':pk': 'TRACKED' },
      ScanIndexForward: false,
      Limit: TOP_N,
    }),
  )

  const symbols = (res.Items ?? [])
    .map((item) => {
      const sk = item.gsi2sk as string // format: "0000000000#SYMBOL"
      return sk.split('#')[1]
    })
    .filter(Boolean)

  if (symbols.length === 0) {
    console.log('PriceWarmup: no tracked tokens found')
    return
  }

  const now = Math.floor(Date.now() / 1000)
  let warmed = 0
  let throttled = 0

  for (const symbol of symbols) {
    for (const interval of WARMUP_INTERVALS) {
      const to = now
      const from = to - 100 * INTERVAL_SECONDS[interval]
      const { rateLimited } = await getOHLCV(symbol, interval, from, to)
      if (rateLimited) {
        throttled++
        // Back off: skip remaining intervals for this symbol to conserve budget
        break
      } else {
        warmed++
      }
    }
  }

  console.log(
    `PriceWarmup: warmed=${warmed} throttled=${throttled} symbols=${symbols.join(',')}`,
  )
}
