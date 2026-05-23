import { beforeEach, describe, expect, test } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'

// Real production functions under test. Static imports are safe here because
// the setupFiles module (integration-env.ts) has already wired the AWS
// endpoint + SST_RESOURCE_* env vars BEFORE this file's imports evaluate, so
// client.ts builds its singleton pointed at the local dynalite server.
import {
  sumPulse,
  incrementPulse,
} from '@monorepo-template/core/db/aggregates'
import {
  updateTokenBuzz,
  getSpikingTokens,
  listTrackedTokens,
  getToken,
  upsertToken,
} from '@monorepo-template/core/db/tokens'
import { minuteBucket } from '@monorepo-template/core/db/keys'
import { computeBuzzDelta } from '@monorepo-template/core/movers'
import { ddb, TableNames } from '@monorepo-template/core/db/client'

const ENDPOINT = 'http://127.0.0.1:8000'
const MINUTE = 60_000

// Window math copied verbatim from packages/jobs/src/spike-materializer.ts so
// the tests exercise the same composition the handler does. Current hour is
// the last 60 minute-buckets; prior hour is the 60 before that; the windows
// are disjoint so the boundary minute is never double-counted.
function windows(now: number) {
  return {
    curFrom: minuteBucket(now - 59 * MINUTE),
    curTo: minuteBucket(now),
    priorFrom: minuteBucket(now - 119 * MINUTE),
    priorTo: minuteBucket(now - 60 * MINUTE),
  }
}

// Seed N pulse events for a symbol into a single minute bucket by calling the
// REAL incrementPulse (writes pk=`PULSE#<sym>`, sk=`BUCKET#<minute>`, count).
// This matches exactly the row shape sumPulse queries.
async function seedPulse(symbol: string, minute: string, n: number) {
  for (let i = 0; i < n; i++) {
    await incrementPulse(symbol, minute)
  }
}

// Low-level scrub between tests: scan each table and delete every row. dynalite
// is in-memory and shared across the single worker, so we clear to keep tests
// isolated regardless of symbol reuse.
const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearTable(tableName: string) {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: tableName,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: tableName,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await Promise.all([
    clearTable(TableNames.tokens),
    clearTable(TableNames.aggregates),
  ])
})

describe('spike pipeline (dynalite integration)', () => {
  // Scenario 1 — the regression test for the original bug: a spiking token must
  // surface via the SpikingByDelta GSI, which only works if the row carries
  // gsi1pk='SPIKE'.
  test('spike surfaces via the SpikingByDelta GSI with gsi1pk=SPIKE', async () => {
    const now = Date.now()
    const w = windows(now)

    // More volume in the current hour than the prior hour → positive delta.
    // Put current volume inside the current window, prior volume inside the
    // prior window. Use a minute safely inside each window.
    await seedPulse('$PEPE', minuteBucket(now - 10 * MINUTE), 20) // current
    await seedPulse('$PEPE', minuteBucket(now - 70 * MINUTE), 10) // prior

    const current = await sumPulse('$PEPE', w.curFrom, w.curTo)
    const prior = await sumPulse('$PEPE', w.priorFrom, w.priorTo)
    expect(current).toBe(20)
    expect(prior).toBe(10)

    const dbuzz = computeBuzzDelta(current, prior)
    expect(dbuzz).toBeGreaterThan(0)
    expect(dbuzz).toBe(100) // (20-10)/10 * 100

    await updateTokenBuzz({ symbol: '$PEPE', dbuzz, mentions: current })

    const spiking = await getSpikingTokens()
    const pepe = spiking.find((t) => t.sym === '$PEPE')
    expect(pepe).toBeDefined()
    expect(pepe!.dbuzz).toBe(100)
    expect(pepe!.gsi1pk).toBe('SPIKE')
  })

  // Scenario 2 — ranking order. Depends on the zero-padded gsi1sk plus
  // ScanIndexForward:false in getSpikingTokens.
  test('getSpikingTokens ranks descending by delta', async () => {
    await updateTokenBuzz({ symbol: '$AAA', dbuzz: 50, mentions: 5 })
    await updateTokenBuzz({ symbol: '$BBB', dbuzz: 300, mentions: 8 })
    await updateTokenBuzz({ symbol: '$CCC', dbuzz: 120, mentions: 6 })

    const spiking = await getSpikingTokens()
    const order = spiking.map((t) => t.sym)
    expect(order).toEqual(['$BBB', '$CCC', '$AAA'])
    expect(spiking.map((t) => t.dbuzz)).toEqual([300, 120, 50])
  })

  // Scenario 3 — a non-spiking token (dbuzz<=0) is dropped from the SPIKE index
  // but remains tracked via gsi2pk='TRACKED'; and the spike→non-spike
  // transition removes it from the SPIKE index.
  test('non-spiking token leaves SPIKE index but stays tracked', async () => {
    // Direct non-spike write.
    await updateTokenBuzz({ symbol: '$MOG', dbuzz: 0, mentions: 5 })

    let spiking = await getSpikingTokens()
    expect(spiking.find((t) => t.sym === '$MOG')).toBeUndefined()

    let tracked = await listTrackedTokens()
    const trackedMog = tracked.find((t) => t.sym === '$MOG')
    expect(trackedMog).toBeDefined()
    expect(trackedMog!.gsi2pk).toBe('TRACKED')
    expect(trackedMog!.gsi1pk).toBeUndefined()

    // Transition: first make it spike, then drop it back to non-spike and
    // confirm the REMOVE gsi1pk/gsi1sk branch evicts it from the SPIKE index.
    await updateTokenBuzz({ symbol: '$MOG', dbuzz: 80, mentions: 12 })
    spiking = await getSpikingTokens()
    expect(spiking.find((t) => t.sym === '$MOG')).toBeDefined()

    await updateTokenBuzz({ symbol: '$MOG', dbuzz: 0, mentions: 12 })
    spiking = await getSpikingTokens()
    expect(spiking.find((t) => t.sym === '$MOG')).toBeUndefined()

    tracked = await listTrackedTokens()
    expect(tracked.find((t) => t.sym === '$MOG')).toBeDefined()
  })

  // Scenario 4 — updateTokenBuzz must not clobber price/name/spark written by
  // upsertToken; it only refreshes buzz fields + GSI keys.
  test('updateTokenBuzz preserves non-buzz fields', async () => {
    await upsertToken({
      sym: '$WIF',
      name: 'dogwifhat',
      price: 2.34,
      d24: 5.1,
      mentions: 3,
      dbuzz: 1,
      sent: 'bull',
      spark: [1, 2, 3, 4, 5],
      updatedAt: new Date(0).toISOString(),
    })

    const before = await getToken('$WIF')
    expect(before).not.toBeNull()
    const originalUpdatedAt = before!.updatedAt

    await updateTokenBuzz({ symbol: '$WIF', dbuzz: 150, mentions: 30 })

    const after = await getToken('$WIF')
    expect(after).not.toBeNull()
    // Untouched fields.
    expect(after!.name).toBe('dogwifhat')
    expect(after!.price).toBe(2.34)
    expect(after!.spark).toEqual([1, 2, 3, 4, 5])
    expect(after!.sent).toBe('bull')
    expect(after!.d24).toBe(5.1)
    // Updated fields.
    expect(after!.dbuzz).toBe(150)
    expect(after!.mentions).toBe(30)
    expect(after!.gsi1pk).toBe('SPIKE')
    expect(after!.updatedAt).not.toBe(originalUpdatedAt)
  })

  // Scenario 5 — sumPulse window correctness. Buckets straddling the
  // current/prior boundary must each be counted in exactly one window with no
  // double counting at the inclusive boundary.
  test('sumPulse sums only buckets within the inclusive window', async () => {
    const now = Date.now()
    const w = windows(now)

    // One bucket at the current-window start edge (curFrom == now-59m),
    // one mid-current, and one at the prior-window end edge (priorTo == now-60m).
    // priorTo is exactly one minute before curFrom, so the boundary is disjoint.
    const atCurFrom = minuteBucket(now - 59 * MINUTE)
    const midCurrent = minuteBucket(now - 30 * MINUTE)
    const atPriorTo = minuteBucket(now - 60 * MINUTE)
    const midPrior = minuteBucket(now - 90 * MINUTE)

    await seedPulse('$SUM', atCurFrom, 3)
    await seedPulse('$SUM', midCurrent, 4)
    await seedPulse('$SUM', atPriorTo, 7)
    await seedPulse('$SUM', midPrior, 5)

    const current = await sumPulse('$SUM', w.curFrom, w.curTo)
    const prior = await sumPulse('$SUM', w.priorFrom, w.priorTo)

    // Current window includes atCurFrom (3) + midCurrent (4) = 7, NOT atPriorTo.
    expect(current).toBe(7)
    // Prior window includes atPriorTo (7) + midPrior (5) = 12, NOT atCurFrom.
    expect(prior).toBe(12)
    // No bucket counted twice across the boundary.
    expect(current + prior).toBe(3 + 4 + 7 + 5)
  })
})
