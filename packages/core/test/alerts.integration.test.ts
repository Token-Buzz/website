/**
 * Alerts integration test — exercises the real `packages/core/src/db/alerts.ts`
 * functions (createAlert, listAlerts, getAlert, deleteAlert, setAlertEnabled,
 * listAlertsForToken, recordAlertTrigger, listTriggers, markTriggerRead,
 * markAllTriggersRead) against a local dynalite DynamoDB.
 *
 * The key bug-class this harness catches: a write that omits gsi1pk/gsi1sk so
 * listAlertsForToken returns zero items even though the rule exists on the base
 * table. Every createAlert call must write those keys; the test verifies it.
 *
 * No KMS needed — alerts don't encrypt any data.
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
  createAlert,
  listAlerts,
  getAlert,
  deleteAlert,
  setAlertEnabled,
  listAlertsForToken,
  recordAlertTrigger,
  listTriggers,
  markTriggerRead,
  markAllTriggersRead,
} from '@monorepo-template/core/db/alerts'

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

// ── createAlert / listAlerts ──────────────────────────────────────────────────

describe('createAlert / listAlerts', () => {
  const USER_ID = 'user_alerts_test'

  test('createAlert returns a rule with correct channel, enabled, and symbol (uppercased)', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'btc',
      condition: 'mention_spike',
      threshold: 50,
    })

    expect(rule.channel).toBe('in_app')
    expect(rule.enabled).toBe(true)
    expect(rule.symbol).toBe('BTC')
    expect(rule.condition).toBe('mention_spike')
    expect(rule.threshold).toBe(50)
    expect(rule.alertId).toBeTruthy()
    expect(rule.userId).toBe(USER_ID)
    expect(rule.createdAt).toBeTruthy()
    expect(rule.updatedAt).toBeTruthy()
  })

  test('listAlerts returns the created rule', async () => {
    const created = await createAlert({
      userId: USER_ID,
      symbol: 'ETH',
      condition: 'price_move',
      threshold: 10,
    })

    const rules = await listAlerts(USER_ID)
    expect(rules).toHaveLength(1)
    expect(rules[0].alertId).toBe(created.alertId)
    expect(rules[0].symbol).toBe('ETH')
  })

  test('listAlerts returns empty array when no rules exist', async () => {
    const rules = await listAlerts('no_such_user')
    expect(rules).toHaveLength(0)
  })

  test('listAlerts returns only ALERT# rows (not TRIGGER# rows)', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 20,
    })
    // Record a trigger — its sk starts with TRIGGER#, must NOT appear in listAlerts.
    await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'SOL',
      condition: 'mention_spike',
      message: 'SOL buzz +25% (1h)',
      value: 25,
      link: '/movers',
    })

    const rules = await listAlerts(USER_ID)
    expect(rules).toHaveLength(1)
    expect(rules[0].alertId).toBe(rule.alertId)
  })
})

// ── listAlertsForToken (ByokHolders GSI) ─────────────────────────────────────

describe('listAlertsForToken — ByokHolders GSI', () => {
  test('finds a rule via the GSI (verifies gsi1pk/gsi1sk are written)', async () => {
    // This is the key bug-class the dynalite harness exists to catch:
    // if gsi1pk/gsi1sk are omitted from the write, the GSI query returns
    // zero items even though the rule exists on the base table.
    await createAlert({
      userId: 'user_gsi_a',
      symbol: 'BTC',
      condition: 'mention_spike',
      threshold: 50,
    })

    const rules = await listAlertsForToken('BTC')
    expect(rules).toHaveLength(1)
    expect(rules[0].symbol).toBe('BTC')
    expect(rules[0].userId).toBe('user_gsi_a')
  })

  test('does NOT return a rule for a different symbol', async () => {
    await createAlert({
      userId: 'user_gsi_b',
      symbol: 'ETH',
      condition: 'mention_spike',
      threshold: 30,
    })

    const rules = await listAlertsForToken('BTC')
    expect(rules).toHaveLength(0)
  })

  test('two users with rules on the same symbol both appear in the GSI query', async () => {
    await createAlert({
      userId: 'user_gsi_c1',
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 10,
    })
    await createAlert({
      userId: 'user_gsi_c2',
      symbol: 'SOL',
      condition: 'price_move',
      threshold: 5,
    })

    const rules = await listAlertsForToken('SOL')
    expect(rules).toHaveLength(2)
    const userIds = rules.map((r) => r.userId).sort()
    expect(userIds).toContain('user_gsi_c1')
    expect(userIds).toContain('user_gsi_c2')
  })

  test('symbol lookup is case-insensitive (stored uppercased)', async () => {
    await createAlert({
      userId: 'user_gsi_d',
      symbol: 'bnb',
      condition: 'mention_spike',
      threshold: 40,
    })

    const rules = await listAlertsForToken('BNB')
    expect(rules).toHaveLength(1)
    expect(rules[0].symbol).toBe('BNB')
  })
})

// ── getAlert / deleteAlert ────────────────────────────────────────────────────

describe('getAlert / deleteAlert', () => {
  const USER_ID = 'user_getdelete_test'

  test('getAlert returns the rule after creation', async () => {
    const created = await createAlert({
      userId: USER_ID,
      symbol: 'ADA',
      condition: 'mention_spike',
      threshold: 25,
    })

    const fetched = await getAlert(USER_ID, created.alertId)
    expect(fetched).not.toBeNull()
    expect(fetched!.alertId).toBe(created.alertId)
    expect(fetched!.symbol).toBe('ADA')
  })

  test('getAlert returns null when no rule exists', async () => {
    const result = await getAlert(USER_ID, 'nonexistent_alert_id')
    expect(result).toBeNull()
  })

  test('deleteAlert removes the rule; getAlert returns null; listAlerts is empty', async () => {
    const created = await createAlert({
      userId: USER_ID,
      symbol: 'DOT',
      condition: 'price_move',
      threshold: 15,
    })

    await deleteAlert(USER_ID, created.alertId)

    expect(await getAlert(USER_ID, created.alertId)).toBeNull()
    expect(await listAlerts(USER_ID)).toHaveLength(0)
  })

  test('deleteAlert on a non-existent rule is a no-op (no throw)', async () => {
    await expect(deleteAlert(USER_ID, 'ghost_alert_id')).resolves.toBeUndefined()
  })
})

// ── setAlertEnabled ───────────────────────────────────────────────────────────

describe('setAlertEnabled', () => {
  const USER_ID = 'user_enable_test'

  test('disabling a rule sets enabled=false', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'LINK',
      condition: 'mention_spike',
      threshold: 60,
    })

    await setAlertEnabled(USER_ID, rule.alertId, false)

    const fetched = await getAlert(USER_ID, rule.alertId)
    expect(fetched).not.toBeNull()
    expect(fetched!.enabled).toBe(false)
  })

  test('re-enabling a rule sets enabled=true', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'MATIC',
      condition: 'price_move',
      threshold: 8,
    })

    await setAlertEnabled(USER_ID, rule.alertId, false)
    await setAlertEnabled(USER_ID, rule.alertId, true)

    const fetched = await getAlert(USER_ID, rule.alertId)
    expect(fetched!.enabled).toBe(true)
  })

  test('setAlertEnabled on a non-existent rule is a safe no-op', async () => {
    await expect(
      setAlertEnabled(USER_ID, 'ghost_alert_id', false),
    ).resolves.toBeUndefined()
  })
})

// ── recordAlertTrigger / listTriggers ─────────────────────────────────────────

describe('recordAlertTrigger / listTriggers', () => {
  const USER_ID = 'user_trigger_test'

  test('recordAlertTrigger returns an AlertTrigger with correct fields', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'BTC',
      condition: 'mention_spike',
      threshold: 50,
    })

    const trigger = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'BTC',
      condition: 'mention_spike',
      message: 'BTC buzz +75% (1h)',
      value: 75,
      link: '/movers',
    })

    expect(trigger.triggerId).toBeTruthy()
    expect(trigger.userId).toBe(USER_ID)
    expect(trigger.alertId).toBe(rule.alertId)
    expect(trigger.symbol).toBe('BTC')
    expect(trigger.condition).toBe('mention_spike')
    expect(trigger.message).toBe('BTC buzz +75% (1h)')
    expect(trigger.value).toBe(75)
    expect(trigger.link).toBe('/movers')
    expect(trigger.read).toBe(false)
    expect(trigger.sk).toMatch(/^TRIGGER#/)
  })

  test('listTriggers returns triggers newest-first', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'ETH',
      condition: 'price_move',
      threshold: 10,
    })

    // Record three triggers with small delays to guarantee distinct timestamps.
    const t1 = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'ETH',
      condition: 'price_move',
      message: 'first',
      value: 11,
      link: '/movers',
    })
    // Introduce a small pause to ensure distinct ISO timestamps.
    await new Promise((r) => setTimeout(r, 5))
    const t2 = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'ETH',
      condition: 'price_move',
      message: 'second',
      value: 12,
      link: '/movers',
    })
    await new Promise((r) => setTimeout(r, 5))
    const t3 = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'ETH',
      condition: 'price_move',
      message: 'third',
      value: 13,
      link: '/movers',
    })

    const triggers = await listTriggers(USER_ID)
    expect(triggers).toHaveLength(3)
    // Newest-first: t3 > t2 > t1.
    expect(triggers[0].triggerId).toBe(t3.triggerId)
    expect(triggers[1].triggerId).toBe(t2.triggerId)
    expect(triggers[2].triggerId).toBe(t1.triggerId)
  })

  test('recordAlertTrigger sets lastTriggeredAt on the parent alert rule', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 30,
    })

    expect((await getAlert(USER_ID, rule.alertId))!.lastTriggeredAt).toBeUndefined()

    await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'SOL',
      condition: 'mention_spike',
      message: 'SOL buzz +35% (1h)',
      value: 35,
      link: '/movers',
    })

    const updated = await getAlert(USER_ID, rule.alertId)
    expect(updated!.lastTriggeredAt).toBeTruthy()
  })

  test('recordAlertTrigger on a deleted rule does not throw', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'ADA',
      condition: 'mention_spike',
      threshold: 20,
    })

    await deleteAlert(USER_ID, rule.alertId)

    await expect(
      recordAlertTrigger({
        userId: USER_ID,
        alertId: rule.alertId,
        symbol: 'ADA',
        condition: 'mention_spike',
        message: 'ADA buzz +25% (1h)',
        value: 25,
        link: '/movers',
      }),
    ).resolves.toBeDefined()
  })

  test('listTriggers respects the limit option', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'DOT',
      condition: 'price_move',
      threshold: 5,
    })

    for (let i = 0; i < 5; i++) {
      await recordAlertTrigger({
        userId: USER_ID,
        alertId: rule.alertId,
        symbol: 'DOT',
        condition: 'price_move',
        message: `DOT price +${6 + i}% (24h)`,
        value: 6 + i,
        link: '/movers',
      })
    }

    const limited = await listTriggers(USER_ID, { limit: 3 })
    expect(limited).toHaveLength(3)
  })
})

// ── markTriggerRead / markAllTriggersRead ─────────────────────────────────────

describe('markTriggerRead / markAllTriggersRead', () => {
  const USER_ID = 'user_read_test'

  test('markTriggerRead flips read from false to true', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'BTC',
      condition: 'mention_spike',
      threshold: 50,
    })
    const trigger = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'BTC',
      condition: 'mention_spike',
      message: 'BTC buzz +60% (1h)',
      value: 60,
      link: '/movers',
    })

    expect(trigger.read).toBe(false)

    await markTriggerRead(USER_ID, trigger.sk)

    const [updated] = await listTriggers(USER_ID)
    expect(updated.read).toBe(true)
  })

  test('markTriggerRead on a non-existent sk is a safe no-op', async () => {
    await expect(
      markTriggerRead(USER_ID, 'TRIGGER#ghost#ghost'),
    ).resolves.toBeUndefined()
  })

  test('markAllTriggersRead sets read=true on every unread trigger', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'ETH',
      condition: 'price_move',
      threshold: 10,
    })

    for (let i = 0; i < 3; i++) {
      await recordAlertTrigger({
        userId: USER_ID,
        alertId: rule.alertId,
        symbol: 'ETH',
        condition: 'price_move',
        message: `ETH price +${11 + i}% (24h)`,
        value: 11 + i,
        link: '/movers',
      })
    }

    // All unread initially.
    const before = await listTriggers(USER_ID)
    expect(before.every((t) => !t.read)).toBe(true)

    await markAllTriggersRead(USER_ID)

    const after = await listTriggers(USER_ID)
    expect(after.every((t) => t.read)).toBe(true)
  })

  test('markAllTriggersRead does not re-mark already-read triggers', async () => {
    const rule = await createAlert({
      userId: USER_ID,
      symbol: 'SOL',
      condition: 'mention_spike',
      threshold: 15,
    })
    const t1 = await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'SOL',
      condition: 'mention_spike',
      message: 'SOL buzz +20% (1h)',
      value: 20,
      link: '/movers',
    })
    await recordAlertTrigger({
      userId: USER_ID,
      alertId: rule.alertId,
      symbol: 'SOL',
      condition: 'mention_spike',
      message: 'SOL buzz +25% (1h)',
      value: 25,
      link: '/movers',
    })

    // Mark one read manually.
    await markTriggerRead(USER_ID, t1.sk)

    // markAllTriggersRead should complete without error (already-read rows are no-ops).
    await expect(markAllTriggersRead(USER_ID)).resolves.toBeUndefined()

    const after = await listTriggers(USER_ID)
    expect(after.every((t) => t.read)).toBe(true)
  })
})
