/**
 * CRUD + trigger inbox for alert rules stored in the UserData table.
 *
 * Alert rule rows:
 *   pk  = USER#<userId>
 *   sk  = ALERT#<alertId>
 *   gsi1pk = ALERTTOKEN#<SYMBOL>   ← ByokHolders GSI (reused, disjoint key space)
 *   gsi1sk = USER#<userId>#<alertId>
 *
 * Trigger (inbox) rows:
 *   pk = USER#<userId>
 *   sk = TRIGGER#<isoTs>#<triggerId>  ← ISO timestamp first → lexicographic = chronological
 *
 * The `TRIGGER#` prefix on trigger rows is entirely disjoint from `ALERT#` used
 * by rule rows, so a begins_with(sk,'ALERT#') query never accidentally matches
 * a trigger row and vice versa.
 *
 * Key-space reuse note: BYOK rows use gsi1pk=`BYOK#<provider>` while alert rows
 * use gsi1pk=`ALERTTOKEN#<SYMBOL>`. The distinct prefixes guarantee there is no
 * collision in the shared ByokHolders GSI — alert rules and BYOK keys live in
 * separate GSI partitions even though they share the same physical index.
 */

import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { alertKey, alertTokenGsi, alertTriggerKey } from './keys'
import type { AlertCondition, AlertRule, SentimentTarget } from '../alerts-eval'

export type { AlertCondition, AlertRule, SentimentTarget }

/** Trigger flavour. 'metric' = threshold alert; 'press' = per-token press alert. (M14 adds 'news'.) */
export type AlertTone = 'metric' | 'press'

export interface AlertTrigger {
  /** Full DynamoDB sort key — passed to markTriggerRead for precise addressing. */
  sk: string
  triggerId: string
  userId: string
  alertId: string
  symbol: string
  /** Undefined is treated as 'metric' for back-compat with existing trigger rows. */
  tone?: AlertTone
  /** Metric triggers only — press triggers have no condition. */
  condition?: AlertCondition
  message: string
  /** Metric triggers only — press triggers have no numeric value. */
  value?: number
  link: string
  createdAt: string
  read: boolean
}

// ── Internal DynamoDB item shape ──────────────────────────────────────────────

interface AlertRuleItem extends AlertRule {
  pk: string
  sk: string
  gsi1pk: string
  gsi1sk: string
}

interface AlertTriggerItem extends AlertTrigger {
  pk: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemToRule(item: Record<string, unknown>): AlertRule {
  return {
    alertId: item.alertId as string,
    userId: item.userId as string,
    symbol: item.symbol as string,
    condition: item.condition as AlertCondition,
    threshold: item.threshold as number,
    target: item.target as SentimentTarget | undefined,
    channel: 'in_app',
    enabled: item.enabled as boolean,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    lastTriggeredAt: item.lastTriggeredAt as string | undefined,
  }
}

function itemToTrigger(item: Record<string, unknown>): AlertTrigger {
  return {
    sk: item.sk as string,
    triggerId: item.triggerId as string,
    userId: item.userId as string,
    alertId: item.alertId as string,
    symbol: item.symbol as string,
    ...(item.tone !== undefined && { tone: item.tone as AlertTone }),
    ...(item.condition !== undefined && { condition: item.condition as AlertCondition }),
    message: item.message as string,
    ...(item.value !== undefined && { value: item.value as number }),
    link: item.link as string,
    createdAt: item.createdAt as string,
    read: item.read as boolean,
  }
}

// ── Alert rule CRUD ───────────────────────────────────────────────────────────

/**
 * Creates a new alert rule for the given user. Generates a UUID for the alertId,
 * sets channel:'in_app' and enabled:true, writes the rule row with both the
 * base table keys and the ByokHolders GSI keys (gsi1pk/gsi1sk) so the rule is
 * discoverable by token via `listAlertsForToken`. Returns the AlertRule shape
 * (without the raw DynamoDB pk/sk/gsi keys).
 */
export async function createAlert(params: {
  userId: string
  symbol: string
  condition: AlertCondition
  threshold: number
  target?: SentimentTarget
}): Promise<AlertRule> {
  const { userId, symbol, condition, threshold, target } = params
  const alertId = crypto.randomUUID()
  const now = new Date().toISOString()
  const sym = symbol.toUpperCase()

  const item: AlertRuleItem = {
    ...alertKey(userId, alertId),
    ...alertTokenGsi(sym, userId, alertId),
    alertId,
    userId,
    symbol: sym,
    condition,
    threshold,
    ...(target !== undefined && { target }),
    channel: 'in_app',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )

  return itemToRule(item as unknown as Record<string, unknown>)
}

/**
 * Returns all alert rules for the given user, ordered by DynamoDB sort key
 * (i.e. creation order for UUIDs that share the same ALERT# prefix).
 */
export async function listAlerts(userId: string): Promise<AlertRule[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'ALERT#',
      },
    }),
  )

  return (Items as Record<string, unknown>[]).map(itemToRule)
}

/**
 * Retrieves a single alert rule by userId and alertId. Returns null if not found.
 */
export async function getAlert(userId: string, alertId: string): Promise<AlertRule | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: alertKey(userId, alertId),
    }),
  )

  if (!Item) return null
  return itemToRule(Item as Record<string, unknown>)
}

/**
 * Deletes an alert rule. No-op if the rule does not exist.
 */
export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.userData,
      Key: alertKey(userId, alertId),
    }),
  )
}

/**
 * Enables or disables an alert rule. Uses a conditional update so that a
 * missing row is a safe no-op (ConditionalCheckFailedException is swallowed).
 */
export async function setAlertEnabled(
  userId: string,
  alertId: string,
  enabled: boolean,
): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TableNames.userData,
        Key: alertKey(userId, alertId),
        UpdateExpression: 'SET enabled = :enabled, updatedAt = :now',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeValues: {
          ':enabled': enabled,
          ':now': new Date().toISOString(),
        },
      }),
    )
  } catch (err) {
    // Row does not exist — treat as a no-op rather than an error.
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return
    throw err
  }
}

/**
 * Queries the ByokHolders GSI for all alert rules for the given token symbol.
 * gsi1pk = `ALERTTOKEN#<SYMBOL>` is disjoint from `BYOK#<provider>` keys used
 * by the BYOK feature — they share the physical index but different partitions.
 *
 * This is the evaluator's lookup: given a symbol, find every user who has a
 * rule for it. The integration test MUST verify that this GSI query works
 * (i.e. that gsi1pk/gsi1sk are written on every createAlert call).
 */
export async function listAlertsForToken(symbol: string): Promise<AlertRule[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      IndexName: 'ByokHolders',
      KeyConditionExpression: 'gsi1pk = :gsi1pk',
      ExpressionAttributeValues: {
        ':gsi1pk': `ALERTTOKEN#${symbol.toUpperCase()}`,
      },
    }),
  )

  return (Items as Record<string, unknown>[]).map(itemToRule)
}

// ── Trigger inbox ─────────────────────────────────────────────────────────────

/**
 * Records a trigger event for an alert rule. Writes a trigger row with an
 * ISO-timestamp-prefixed sort key so that `listTriggers` returns items newest-
 * first when using ScanIndexForward:false. Also updates the parent alert rule's
 * `lastTriggeredAt` field (conditional update so missing rule is a no-op).
 */
export async function recordAlertTrigger(params: {
  userId: string
  alertId: string
  symbol: string
  condition: AlertCondition
  message: string
  value: number
  link: string
}): Promise<AlertTrigger> {
  const { userId, alertId, symbol, condition, message, value, link } = params
  const triggerId = crypto.randomUUID()
  const isoTs = new Date().toISOString()

  const triggerKey = alertTriggerKey(userId, isoTs, triggerId)
  const item: AlertTriggerItem = {
    ...triggerKey,
    triggerId,
    userId,
    alertId,
    symbol: symbol.toUpperCase(),
    condition,
    message,
    value,
    link,
    createdAt: isoTs,
    read: false,
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )

  // Update lastTriggeredAt on the parent rule. Swallow ConditionalCheckFailedException
  // so that a trigger for a deleted rule is still recorded (the trigger row is
  // the source of truth for the inbox; the rule update is best-effort).
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TableNames.userData,
        Key: alertKey(userId, alertId),
        UpdateExpression: 'SET lastTriggeredAt = :ts',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeValues: { ':ts': isoTs },
      }),
    )
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      // Rule was deleted — trigger inbox row is already written; proceed.
    } else {
      throw err
    }
  }

  return itemToTrigger(item as unknown as Record<string, unknown>)
}

/**
 * Records a press-alert trigger in the same inbox partition as metric triggers
 * (sk = TRIGGER#<isoTs>#<triggerId>). Press triggers have no parent rule row, so
 * `alertId` is the synthetic literal 'press' and no rule is updated. They carry
 * `tone: 'press'` and an external article `link`, and never write condition/value.
 */
export async function recordPressTrigger(params: {
  userId: string
  symbol: string
  title: string
  link: string
  sourceName: string
}): Promise<AlertTrigger> {
  const { userId, symbol, title, link } = params
  const triggerId = crypto.randomUUID()
  const isoTs = new Date().toISOString()
  const sym = symbol.toUpperCase()

  const item: AlertTriggerItem & { tone: AlertTone } = {
    ...alertTriggerKey(userId, isoTs, triggerId),
    triggerId,
    userId,
    alertId: 'press',
    symbol: sym,
    tone: 'press',
    message: `New press · $${sym}: ${title}`,
    link,
    createdAt: isoTs,
    read: false,
  }

  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )

  return itemToTrigger(item as unknown as Record<string, unknown>)
}

/**
 * Returns the most-recent triggers for a user (newest-first).
 * Defaults to 50 items. The sort key prefix `TRIGGER#` is disjoint from
 * `ALERT#` rule rows so this query never returns alert rule items.
 */
export async function listTriggers(
  userId: string,
  opts?: { limit?: number },
): Promise<AlertTrigger[]> {
  const limit = opts?.limit ?? 50

  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'TRIGGER#',
      },
      ScanIndexForward: false,
      Limit: limit,
    }),
  )

  return (Items as Record<string, unknown>[]).map(itemToTrigger)
}

/**
 * Marks a single trigger as read. The `sk` is the full sort key returned by
 * `listTriggers`. Uses a conditional update so a missing row is a safe no-op.
 */
export async function markTriggerRead(userId: string, sk: string): Promise<void> {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TableNames.userData,
        Key: { pk: `USER#${userId}`, sk },
        UpdateExpression: 'SET #r = :true',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeNames: { '#r': 'read' },
        ExpressionAttributeValues: { ':true': true },
      }),
    )
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return
    throw err
  }
}

/**
 * Marks all unread triggers for a user as read. Simple sequential loop — fine
 * for v1 volumes; can be replaced with a batch-write if needed.
 */
export async function markAllTriggersRead(userId: string): Promise<void> {
  const triggers = await listTriggers(userId)
  for (const trigger of triggers) {
    if (!trigger.read) {
      await markTriggerRead(userId, trigger.sk)
    }
  }
}
