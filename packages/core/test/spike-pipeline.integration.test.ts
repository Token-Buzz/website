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

// Helper: build a deltas record with the same value in all three windows,
// useful for scenarios that only care about one window.
function allWindows(delta: number): Record<'1H' | '24H' | '7D', number> {
  return { '1H': delta, '24H': delta, '7D': delta }
}

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

    await updateTokenBuzz({ symbol: '$PEPE', mentions: current, deltas: allWindows(dbuzz) })

    const spiking = await getSpikingTokens()
    const pepe = spiking.find((t) => t.sym === '$PEPE')
    expect(pepe).toBeDefined()
    expect(pepe!.dbuzz).toBe(100)
    expect(pepe!.gsi1pk).toBe('SPIKE')
  })

  // Scenario 2 — ranking order. Depends on the zero-padded gsi1sk plus
  // ScanIndexForward:false in getSpikingTokens.
  test('getSpikingTokens ranks descending by delta', async () => {
    await updateTokenBuzz({ symbol: '$AAA', mentions: 5, deltas: allWindows(50) })
    await updateTokenBuzz({ symbol: '$BBB', mentions: 8, deltas: allWindows(300) })
    await updateTokenBuzz({ symbol: '$CCC', mentions: 6, deltas: allWindows(120) })

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
    await updateTokenBuzz({ symbol: '$MOG', mentions: 5, deltas: allWindows(0) })

    let spiking = await getSpikingTokens()
    expect(spiking.find((t) => t.sym === '$MOG')).toBeUndefined()

    let tracked = await listTrackedTokens()
    const trackedMog = tracked.find((t) => t.sym === '$MOG')
    expect(trackedMog).toBeDefined()
    expect(trackedMog!.gsi2pk).toBe('TRACKED')
    expect(trackedMog!.gsi1pk).toBeUndefined()

    // Transition: first make it spike, then drop it back to non-spike and
    // confirm the REMOVE gsi1pk/gsi1sk branch evicts it from the SPIKE index.
    await updateTokenBuzz({ symbol: '$MOG', mentions: 12, deltas: allWindows(80) })
    spiking = await getSpikingTokens()
    expect(spiking.find((t) => t.sym === '$MOG')).toBeDefined()

    await updateTokenBuzz({ symbol: '$MOG', mentions: 12, deltas: allWindows(0) })
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

    await updateTokenBuzz({ symbol: '$WIF', mentions: 30, deltas: allWindows(150) })

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

describe('multi-window spike pipeline (dynalite integration)', () => {
  // Scenario 6 — per-window GSI isolation: a token positive in 24H but ≤0 in 1H
  // appears in getSpikingTokens({window:'24H'}) but NOT in the 1H index.
  test('token positive in 24H only appears in 24H index, not 1H', async () => {
    // 1H delta = 0 (non-positive), 24H delta = 200, 7D delta = 0.
    await updateTokenBuzz({
      symbol: '$ONLY24H',
      mentions: 5,
      deltas: { '1H': 0, '24H': 200, '7D': 0 },
    })

    // Must NOT be in the 1H spiking index.
    const spiking1h = await getSpikingTokens({ window: '1H' })
    expect(spiking1h.find((t) => t.sym === '$ONLY24H')).toBeUndefined()

    // MUST be in the 24H spiking index with the correct delta.
    const spiking24h = await getSpikingTokens({ window: '24H' })
    const token24h = spiking24h.find((t) => t.sym === '$ONLY24H')
    expect(token24h).toBeDefined()
    expect(token24h!.dbuzz24h).toBe(200)
    expect(token24h!.gsi3pk).toBe('SPIKE#24H')

    // Must NOT be in the 7D spiking index.
    const spiking7d = await getSpikingTokens({ window: '7D' })
    expect(spiking7d.find((t) => t.sym === '$ONLY24H')).toBeUndefined()
  })

  // Scenario 7 — per-window ranking: each index ranks by its own delta
  // independently of other windows.
  test('getSpikingTokens ranks correctly per window', async () => {
    // $X: high 1H (300), low 24H (50), high 7D (400).
    // $Y: low 1H (50), high 24H (300), low 7D (100).
    await updateTokenBuzz({
      symbol: '$X',
      mentions: 10,
      deltas: { '1H': 300, '24H': 50, '7D': 400 },
    })
    await updateTokenBuzz({
      symbol: '$Y',
      mentions: 10,
      deltas: { '1H': 50, '24H': 300, '7D': 100 },
    })

    // 1H: $X (300) before $Y (50).
    const order1h = (await getSpikingTokens({ window: '1H' })).map((t) => t.sym)
    expect(order1h.indexOf('$X')).toBeLessThan(order1h.indexOf('$Y'))

    // 24H: $Y (300) before $X (50).
    const order24h = (await getSpikingTokens({ window: '24H' })).map((t) => t.sym)
    expect(order24h.indexOf('$Y')).toBeLessThan(order24h.indexOf('$X'))

    // 7D: $X (400) before $Y (100).
    const order7d = (await getSpikingTokens({ window: '7D' })).map((t) => t.sym)
    expect(order7d.indexOf('$X')).toBeLessThan(order7d.indexOf('$Y'))
  })

  // Scenario 8 — eviction: dropping a window's delta to ≤0 removes it from
  // that window's GSI while leaving other windows intact.
  test('dropping one window delta to ≤0 evicts from that index only', async () => {
    // Start with all three windows positive.
    await updateTokenBuzz({
      symbol: '$EVICT',
      mentions: 15,
      deltas: { '1H': 100, '24H': 150, '7D': 80 },
    })

    // Verify present in all three indices.
    expect((await getSpikingTokens({ window: '1H' })).find((t) => t.sym === '$EVICT')).toBeDefined()
    expect((await getSpikingTokens({ window: '24H' })).find((t) => t.sym === '$EVICT')).toBeDefined()
    expect((await getSpikingTokens({ window: '7D' })).find((t) => t.sym === '$EVICT')).toBeDefined()

    // Drop the 24H delta to 0; keep 1H and 7D positive.
    await updateTokenBuzz({
      symbol: '$EVICT',
      mentions: 15,
      deltas: { '1H': 100, '24H': 0, '7D': 80 },
    })

    // Still in 1H and 7D.
    expect((await getSpikingTokens({ window: '1H' })).find((t) => t.sym === '$EVICT')).toBeDefined()
    expect((await getSpikingTokens({ window: '7D' })).find((t) => t.sym === '$EVICT')).toBeDefined()

    // Evicted from 24H.
    expect((await getSpikingTokens({ window: '24H' })).find((t) => t.sym === '$EVICT')).toBeUndefined()

    // Row still tracked (gsi2pk='TRACKED').
    const tracked = await listTrackedTokens()
    expect(tracked.find((t) => t.sym === '$EVICT')).toBeDefined()

    // GSI keys for 24H are removed from the item.
    const item = await getToken('$EVICT')
    expect(item!.gsi3pk).toBeUndefined()
    expect(item!.gsi3sk).toBeUndefined()
    // GSI keys for 1H and 7D are still present.
    expect(item!.gsi1pk).toBe('SPIKE')
    expect(item!.gsi4pk).toBe('SPIKE#7D')
  })

  // Scenario 9 — window-specific delta fields are stored on the record and
  // readable back: dbuzz1h, dbuzz24h, dbuzz7d.
  test('all three window deltas are stored and readable on the record', async () => {
    await updateTokenBuzz({
      symbol: '$FIELDS',
      mentions: 20,
      deltas: { '1H': 111, '24H': 222, '7D': 333 },
    })

    const item = await getToken('$FIELDS')
    expect(item).not.toBeNull()
    expect(item!.dbuzz).toBe(111)   // back-compat 1H field
    expect(item!.dbuzz1h).toBe(111)
    expect(item!.dbuzz24h).toBe(222)
    expect(item!.dbuzz7d).toBe(333)
  })
})
