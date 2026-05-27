import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { planKey, usageKey } from './keys'
import { type Plan, DEFAULT_PLAN, evaluateHumQuota } from '../billing/tiers'

export type { Plan }

export function currentPeriod(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7).replace('-', '')
}

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
  return { plan: Item.plan as Plan }
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
  const [{ plan }, used] = await Promise.all([
    getUserPlan(userId),
    getHumUsage(userId),
  ])
  const { allowed, limit } = evaluateHumQuota(plan, used)
  return { allowed, used, limit, plan }
}

export async function recordHumUsage(
  userId: string,
  period = currentPeriod(),
): Promise<number> {
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
