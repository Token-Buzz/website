/**
 * Stripe-webhook data layer: idempotency, the customer→user index, and the
 * PLAN row writer. The PLAN row shape stays compatible with the existing
 * reader in usage.ts (`getUserPlan` only needs the `plan` attribute).
 *
 * Key builders live in keys.ts; never inline pk/sk here.
 */

import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { planKey, stripeEventKey, stripeCustomerKey } from './keys'
import type { Plan, BillingInterval } from '../billing/tiers'
import type { PlanStatus } from '../billing/stripe'

export type { PlanStatus }

export interface PlanRecord {
  plan: Plan
  status: PlanStatus
  interval?: BillingInterval
  currentPeriodEnd?: string // ISO-8601
  cancelAtPeriodEnd?: boolean
  stripeCustomerId?: string
  stripeSubId?: string
  updatedAt?: string
}

export interface ApplySubscriptionInput {
  userId: string
  plan: Plan
  status: PlanStatus
  interval?: BillingInterval
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
  stripeCustomerId: string
  stripeSubId: string
}

// ── Idempotency ────────────────────────────────────────────────────────────

export async function isStripeEventProcessed(eventId: string): Promise<boolean> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: stripeEventKey(eventId),
    }),
  )
  return !!Item
}

export async function markStripeEventProcessed(
  eventId: string,
  type?: string,
): Promise<void> {
  const item: Record<string, unknown> = {
    ...stripeEventKey(eventId),
    processedAt: new Date().toISOString(),
  }
  if (type !== undefined) item.type = type
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )
}

// ── PLAN row read ────────────────────────────────────────────────────────────

export async function getPlanRecord(userId: string): Promise<PlanRecord | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: planKey(userId),
    }),
  )
  if (!Item || !Item.plan) return null
  return {
    plan: Item.plan as Plan,
    status: Item.status as PlanStatus,
    interval: Item.interval as BillingInterval | undefined,
    currentPeriodEnd: Item.currentPeriodEnd as string | undefined,
    cancelAtPeriodEnd: Item.cancelAtPeriodEnd as boolean | undefined,
    stripeCustomerId: Item.stripeCustomerId as string | undefined,
    stripeSubId: Item.stripeSubId as string | undefined,
    updatedAt: Item.updatedAt as string | undefined,
  }
}

// ── Customer → user index ──────────────────────────────────────────────────

export async function upsertCustomerUserIndex(
  customerId: string,
  userId: string,
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: {
        ...stripeCustomerKey(customerId),
        userId,
        updatedAt: new Date().toISOString(),
      },
    }),
  )
}

export async function resolveUserIdByCustomer(
  customerId: string,
): Promise<string | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: stripeCustomerKey(customerId),
    }),
  )
  return (Item?.userId as string) ?? null
}

// ── PLAN row writes ──────────────────────────────────────────────────────────

export async function applySubscriptionToPlan(
  input: ApplySubscriptionInput,
): Promise<void> {
  const item: Record<string, unknown> = {
    ...planKey(input.userId),
    plan: input.plan,
    status: input.status,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubId: input.stripeSubId,
    updatedAt: new Date().toISOString(),
  }
  if (input.interval !== undefined) item.interval = input.interval
  if (input.currentPeriodEnd !== undefined)
    item.currentPeriodEnd = input.currentPeriodEnd
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )
}

export async function downgradeToFree(
  userId: string,
  opts?: { stripeCustomerId?: string },
): Promise<void> {
  const item: Record<string, unknown> = {
    ...planKey(userId),
    plan: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
    updatedAt: new Date().toISOString(),
  }
  if (opts?.stripeCustomerId !== undefined)
    item.stripeCustomerId = opts.stripeCustomerId
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: item,
    }),
  )
}

export async function setPlanStatus(
  userId: string,
  status: PlanStatus,
  currentPeriodEnd?: string,
): Promise<void> {
  // `status` is a DynamoDB reserved word — alias it via ExpressionAttributeNames.
  let UpdateExpression = 'SET #s = :s, updatedAt = :now'
  const ExpressionAttributeValues: Record<string, unknown> = {
    ':s': status,
    ':now': new Date().toISOString(),
  }
  if (currentPeriodEnd !== undefined) {
    UpdateExpression += ', currentPeriodEnd = :cpe'
    ExpressionAttributeValues[':cpe'] = currentPeriodEnd
  }
  await ddb.send(
    new UpdateCommand({
      TableName: TableNames.userData,
      Key: planKey(userId),
      UpdateExpression,
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues,
    }),
  )
}
