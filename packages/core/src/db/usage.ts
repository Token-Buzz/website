import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { planKey, usageKey } from './keys'
import {
  type Plan,
  DEFAULT_PLAN,
  evaluateHumQuota,
  evaluateIngestionQuota,
  evaluateRefreshQuota,
  monthPeriod,
  periodForPlan,
} from '../billing/tiers'
import { effectivePlan } from '../billing/stripe'

export type { Plan }

/** Backward-compatible re-export of the monthly period helper. */
export const currentPeriod = monthPeriod

export interface HumQuotaStatus {
  allowed: boolean
  used: number
  limit: number | null
  plan: Plan
}

export async function getUserPlan(userId: string): Promise<{ plan: Plan }> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: planKey(userId),
    }),
  )
  if (!Item || !Item.plan) return { plan: DEFAULT_PLAN }
  return {
    plan: effectivePlan({
      plan: Item.plan as Plan,
      status: Item.status as string | undefined,
      gracePeriodEndsAt: Item.gracePeriodEndsAt as string | undefined,
    }),
  }
}

export async function getHumUsage(
  userId: string,
  period = currentPeriod(),
): Promise<number> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'hum'),
    }),
  )
  return (Item?.count as number) ?? 0
}

export async function canUseHum(userId: string): Promise<HumQuotaStatus> {
  const { plan } = await getUserPlan(userId)
  const period = periodForPlan(plan)
  const [used] = await Promise.all([getHumUsage(userId, period)])
  const { allowed, limit } = evaluateHumQuota(plan, used)
  return { allowed, used, limit, plan }
}

export async function recordHumUsage(
  userId: string,
  period?: string,
): Promise<number> {
  if (period === undefined) {
    const { plan } = await getUserPlan(userId)
    period = periodForPlan(plan)
  }
  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'hum'),
      UpdateExpression: 'ADD #count :one SET updatedAt = :now',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: {
        ':one': 1,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return (Attributes?.count as number) ?? 0
}

export interface IngestionQuotaStatus {
  allowed: boolean
  used: number
  limit: number | null
  plan: Plan
}

export async function getIngestionUsage(
  userId: string,
  period = currentPeriod(),
): Promise<number> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'queries'),
    }),
  )
  return (Item?.count as number) ?? 0
}

export async function canIngestQuery(userId: string): Promise<IngestionQuotaStatus> {
  const { plan } = await getUserPlan(userId)
  const period = periodForPlan(plan)
  const used = await getIngestionUsage(userId, period)
  const { allowed, limit } = evaluateIngestionQuota(plan, used)
  return { allowed, used, limit, plan }
}

export async function recordIngestionUsage(
  userId: string,
  period?: string,
): Promise<number> {
  if (period === undefined) {
    const { plan } = await getUserPlan(userId)
    period = periodForPlan(plan)
  }
  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'queries'),
      UpdateExpression: 'ADD #count :one SET updatedAt = :now',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: {
        ':one': 1,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return (Attributes?.count as number) ?? 0
}

export interface RefreshQuotaStatus {
  allowed: boolean
  used: number
  limit: number | null
  plan: Plan
}

export async function getRefreshUsage(
  userId: string,
  period = currentPeriod(),
): Promise<number> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'refresh'),
    }),
  )
  return (Item?.count as number) ?? 0
}

export async function canRefreshQuery(userId: string): Promise<RefreshQuotaStatus> {
  const { plan } = await getUserPlan(userId)
  const period = periodForPlan(plan)
  const used = await getRefreshUsage(userId, period)
  const { allowed, limit } = evaluateRefreshQuota(plan, used)
  return { allowed, used, limit, plan }
}

export async function recordRefreshUsage(
  userId: string,
  period?: string,
): Promise<number> {
  if (period === undefined) {
    const { plan } = await getUserPlan(userId)
    period = periodForPlan(plan)
  }
  const { Attributes } = await ddb.send(
    new UpdateCommand({
      TableName: TableNames.userData,
      Key: usageKey(userId, period, 'refresh'),
      UpdateExpression: 'ADD #count :one SET updatedAt = :now',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: {
        ':one': 1,
        ':now': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    }),
  )
  return (Attributes?.count as number) ?? 0
}
