/**
 * Watchlist press-alerts integration test — exercises the real
 * `packages/core/src/db/watchlist-entries.ts` (setWatchlistAlertPrefs,
 * listWatchersForSymbol, updateWatchlistEntry) and the press-trigger path in
 * `packages/core/src/db/alerts.ts` (recordPressTrigger) against a local
 * dynalite DynamoDB.
 *
 * The critical bug-class this harness catches: a write that omits gsi1pk/gsi1sk
 * so listWatchersForSymbol (the WatchersBySymbol partition on the ByokHolders
 * GSI) returns zero items even though the entry exists on the base table — and
 * the inverse, a stale gsi key left behind when press alerts are toggled off or
 * the symbol changes.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import {
  createWatchlistEntry,
  setWatchlistAlertPrefs,
  listWatchersForSymbol,
  updateWatchlistEntry,
} from '@monorepo-template/core/db/watchlist-entries'
import { recordPressTrigger, recordNewsTrigger, listTriggers } from '@monorepo-template/core/db/alerts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const ENDPOINT = 'http://127.0.0.1:8000'
const rawClient = new DynamoDBClient({
  endpoint: ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
})

async function clearUserData() {
  const { Items = [] } = await rawClient.send(
    new ScanCommand({
      TableName: TableNames.userData,
      ProjectionExpression: 'pk, sk',
    }),
  )
  for (const item of Items as Array<Record<string, AttributeValue>>) {
    await ddb.send(
      new DeleteCommand({
        TableName: TableNames.userData,
        Key: { pk: item.pk.S, sk: item.sk.S },
      }),
    )
  }
}

beforeEach(async () => {
  await clearUserData()
})

// ── setWatchlistAlertPrefs / listWatchersForSymbol ───────────────────────────

describe('setWatchlistAlertPrefs / listWatchersForSymbol — WatchersBySymbol GSI', () => {
  const USER_ID = 'user_watch_prefs'

  test('enabling press alerts writes gsi keys; listWatchersForSymbol finds the entry', async () => {
    // Critical write→read-through-index round-trip: if gsi1pk/gsi1sk are omitted
    // from the write, the GSI query returns zero items even though the row exists.
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'pepe',
      query: 'pepe',
    })

    const updated = await setWatchlistAlertPrefs(USER_ID, entry.entryId, {
      pressAlerts: true,
    })
    expect(updated).not.toBeNull()
    expect(updated!.pressAlerts).toBe(true)
    expect(updated!.gsi1pk).toBe('WATCHSYM#PEPE')
    expect(updated!.gsi1sk).toBe(`USER#${USER_ID}`)

    const watchers = await listWatchersForSymbol('PEPE')
    expect(watchers).toHaveLength(1)
    expect(watchers[0].entryId).toBe(entry.entryId)
    expect(watchers[0].userId).toBe(USER_ID)
    expect(watchers[0].symbol).toBe('PEPE')
  })

  test('symbol lookup is case-insensitive', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'WIF',
      query: 'wif',
    })
    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: true })

    const watchers = await listWatchersForSymbol('wif')
    expect(watchers).toHaveLength(1)
    expect(watchers[0].entryId).toBe(entry.entryId)
  })

  test('disabling press alerts drops the entry out of the GSI', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'DOGE',
      query: 'doge',
    })
    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: true })
    expect(await listWatchersForSymbol('DOGE')).toHaveLength(1)

    const off = await setWatchlistAlertPrefs(USER_ID, entry.entryId, {
      pressAlerts: false,
    })
    expect(off).not.toBeNull()
    expect(off!.pressAlerts).toBe(false)
    expect(off!.gsi1pk).toBeUndefined()
    expect(off!.gsi1sk).toBeUndefined()

    expect(await listWatchersForSymbol('DOGE')).toHaveLength(0)
  })

  test('setWatchlistAlertPrefs on a missing entry returns null', async () => {
    const result = await setWatchlistAlertPrefs(USER_ID, 'we_ghost', {
      pressAlerts: true,
    })
    expect(result).toBeNull()
  })

  test('two users watching the same symbol both appear', async () => {
    const e1 = await createWatchlistEntry({ userId: 'user_a', symbol: 'BONK', query: 'bonk' })
    const e2 = await createWatchlistEntry({ userId: 'user_b', symbol: 'BONK', query: 'bonk' })
    await setWatchlistAlertPrefs('user_a', e1.entryId, { pressAlerts: true })
    await setWatchlistAlertPrefs('user_b', e2.entryId, { pressAlerts: true })

    const watchers = await listWatchersForSymbol('BONK')
    expect(watchers).toHaveLength(2)
    const userIds = watchers.map((w) => w.userId).sort()
    expect(userIds).toEqual(['user_a', 'user_b'])
  })
})

// ── updateWatchlistEntry maintains the GSI invariant ─────────────────────────

describe('updateWatchlistEntry — GSI invariant on symbol change', () => {
  const USER_ID = 'user_symbol_change'

  test('changing symbol while opted-in moves the entry to the new partition', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'AAA',
      query: 'aaa',
    })
    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: true })
    expect(await listWatchersForSymbol('AAA')).toHaveLength(1)

    const moved = await updateWatchlistEntry(USER_ID, entry.entryId, { symbol: 'bbb' })
    expect(moved).not.toBeNull()
    expect(moved!.symbol).toBe('BBB')
    expect(moved!.gsi1pk).toBe('WATCHSYM#BBB')

    // Old partition is now empty; the new one has the entry.
    expect(await listWatchersForSymbol('AAA')).toHaveLength(0)
    const bbb = await listWatchersForSymbol('BBB')
    expect(bbb).toHaveLength(1)
    expect(bbb[0].entryId).toBe(entry.entryId)
  })

  test('updating a non-opted-in entry never writes gsi keys', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'CCC',
      query: 'ccc',
    })
    const updated = await updateWatchlistEntry(USER_ID, entry.entryId, { query: 'new' })
    expect(updated!.gsi1pk).toBeUndefined()
    expect(updated!.gsi1sk).toBeUndefined()
    expect(await listWatchersForSymbol('CCC')).toHaveLength(0)
  })
})

// ── recordPressTrigger ────────────────────────────────────────────────────────

describe('recordPressTrigger', () => {
  const USER_ID = 'user_press_trigger'

  test('records a press trigger surfaced by listTriggers with tone, symbol/title message and external link', async () => {
    const link = 'https://example.com/press/pepe-listing'
    const trigger = await recordPressTrigger({
      userId: USER_ID,
      symbol: 'pepe',
      title: 'PEPE lists on MegaExchange',
      link,
      sourceName: 'CoinDesk',
    })

    expect(trigger.tone).toBe('press')
    expect(trigger.alertId).toBe('press')
    expect(trigger.symbol).toBe('PEPE')
    expect(trigger.condition).toBeUndefined()
    expect(trigger.value).toBeUndefined()
    expect(trigger.link).toBe(link)
    expect(trigger.read).toBe(false)
    expect(trigger.sk).toMatch(/^TRIGGER#/)
    expect(trigger.message).toContain('PEPE')
    expect(trigger.message).toContain('PEPE lists on MegaExchange')

    const triggers = await listTriggers(USER_ID)
    expect(triggers).toHaveLength(1)
    const fetched = triggers[0]
    expect(fetched.tone).toBe('press')
    expect(fetched.symbol).toBe('PEPE')
    expect(fetched.link).toBe(link)
    expect(fetched.message).toContain('PEPE lists on MegaExchange')
    expect(fetched.condition).toBeUndefined()
    expect(fetched.value).toBeUndefined()
  })
})

// ── newsAlerts GSI gating (M14 Phase 4) ──────────────────────────────────────

describe('setWatchlistAlertPrefs — newsAlerts GSI gating (M14 Phase 4)', () => {
  const USER_ID = 'user_news_prefs'

  test('enabling newsAlerts writes gsi keys; listWatchersForSymbol finds the entry', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'wif',
      query: 'wif',
    })

    const updated = await setWatchlistAlertPrefs(USER_ID, entry.entryId, {
      newsAlerts: true,
    })
    expect(updated).not.toBeNull()
    expect(updated!.newsAlerts).toBe(true)
    expect(updated!.gsi1pk).toBe('WATCHSYM#WIF')
    expect(updated!.gsi1sk).toBe(`USER#${USER_ID}`)

    const watchers = await listWatchersForSymbol('WIF')
    expect(watchers).toHaveLength(1)
    expect(watchers[0].entryId).toBe(entry.entryId)
    expect(watchers[0].userId).toBe(USER_ID)
    expect(watchers[0].symbol).toBe('WIF')
  })

  test('disabling newsAlerts (with pressAlerts also false) drops the entry from the GSI', async () => {
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'BONK',
      query: 'bonk',
    })
    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { newsAlerts: true })
    expect(await listWatchersForSymbol('BONK')).toHaveLength(1)

    const off = await setWatchlistAlertPrefs(USER_ID, entry.entryId, { newsAlerts: false })
    expect(off).not.toBeNull()
    expect(off!.newsAlerts).toBe(false)
    expect(off!.gsi1pk).toBeUndefined()
    expect(off!.gsi1sk).toBeUndefined()

    expect(await listWatchersForSymbol('BONK')).toHaveLength(0)
  })

  test('combined gating: pressAlerts=false but newsAlerts=true keeps entry in GSI', async () => {
    // This is the critical shared-GSI test: the GSI must be present when EITHER
    // pressAlerts OR newsAlerts is true. An entry with press=false but news=true
    // must still appear in listWatchersForSymbol.
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'DOGE',
      query: 'doge',
    })

    // Enable both, then disable press only — entry must remain visible
    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: true, newsAlerts: true })
    expect(await listWatchersForSymbol('DOGE')).toHaveLength(1)

    const pressOff = await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: false })
    expect(pressOff!.pressAlerts).toBe(false)
    expect(pressOff!.newsAlerts).toBe(true)
    // GSI keys must still be present (newsAlerts is still true)
    expect(pressOff!.gsi1pk).toBe('WATCHSYM#DOGE')
    expect(pressOff!.gsi1sk).toBe(`USER#${USER_ID}`)
    expect(await listWatchersForSymbol('DOGE')).toHaveLength(1)

    // Turning BOTH off must remove it from the GSI
    const bothOff = await setWatchlistAlertPrefs(USER_ID, entry.entryId, { newsAlerts: false })
    expect(bothOff!.gsi1pk).toBeUndefined()
    expect(bothOff!.gsi1sk).toBeUndefined()
    expect(await listWatchersForSymbol('DOGE')).toHaveLength(0)
  })

  test('combined gating: newsAlerts=false but pressAlerts=true keeps entry in GSI', async () => {
    // Symmetric case: press=true, news=false → entry must stay in GSI
    const entry = await createWatchlistEntry({
      userId: USER_ID,
      symbol: 'PEPE',
      query: 'pepe',
    })

    await setWatchlistAlertPrefs(USER_ID, entry.entryId, { pressAlerts: true, newsAlerts: true })
    expect(await listWatchersForSymbol('PEPE')).toHaveLength(1)

    // Disable news only
    const newsOff = await setWatchlistAlertPrefs(USER_ID, entry.entryId, { newsAlerts: false })
    expect(newsOff!.pressAlerts).toBe(true)
    expect(newsOff!.newsAlerts).toBe(false)
    expect(newsOff!.gsi1pk).toBe('WATCHSYM#PEPE')
    expect(await listWatchersForSymbol('PEPE')).toHaveLength(1)
  })
})

// ── recordNewsTrigger (M14 Phase 4) ──────────────────────────────────────────

describe('recordNewsTrigger', () => {
  const USER_ID = 'user_news_trigger'

  test('records a news trigger surfaced by listTriggers with tone:news, alertId:news, symbol/title message and external link', async () => {
    const link = 'https://example.com/news/wif-partnership'
    const trigger = await recordNewsTrigger({
      userId: USER_ID,
      symbol: 'wif',
      title: 'WIF announces major partnership',
      link,
      sourceName: 'CryptoNews',
    })

    expect(trigger.tone).toBe('news')
    expect(trigger.alertId).toBe('news')
    expect(trigger.symbol).toBe('WIF')
    expect(trigger.condition).toBeUndefined()
    expect(trigger.value).toBeUndefined()
    expect(trigger.link).toBe(link)
    expect(trigger.read).toBe(false)
    expect(trigger.sk).toMatch(/^TRIGGER#/)
    expect(trigger.message).toContain('WIF')
    expect(trigger.message).toContain('WIF announces major partnership')

    const triggers = await listTriggers(USER_ID)
    expect(triggers).toHaveLength(1)
    const fetched = triggers[0]
    expect(fetched.tone).toBe('news')
    expect(fetched.alertId).toBe('news')
    expect(fetched.symbol).toBe('WIF')
    expect(fetched.link).toBe(link)
    expect(fetched.message).toContain('WIF announces major partnership')
    expect(fetched.condition).toBeUndefined()
    expect(fetched.value).toBeUndefined()
  })
})
