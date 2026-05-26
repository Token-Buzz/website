import { randomUUID } from 'node:crypto'
import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { dashboardKey } from './keys'

// ── Types ────────────────────────────────────────────────────────────────────

export type DashboardCardType =
  | 'mentions' | 'sentiment' | 'hashtags' | 'domains'
  | 'languages' | 'sources' | 'top-authors' | 'candlestick'

export interface DashboardCard {
  id: string
  type: DashboardCardType
  position: { x: number; y: number; w: number; h: number }
  options: Record<string, unknown>
}

/** A persisted dashboard row in the UserData table. */
export interface Dashboard {
  pk: string
  sk: string
  userId: string
  dashboardId: string
  name: string
  ticker?: string
  query?: string
  cards: DashboardCard[]
  createdAt: string
  updatedAt: string
}

/** Input for creating a dashboard (validation happens in the API layer). */
export interface CreateDashboardInput {
  name: string
  ticker?: string
  query?: string
  cards?: DashboardCard[]
}

/** Partial patch for updating a dashboard. */
export interface UpdateDashboardPatch {
  name?: string
  ticker?: string
  query?: string
  cards?: DashboardCard[]
}

// ── CRUD functions ───────────────────────────────────────────────────────────

export async function createDashboard(
  userId: string,
  input: CreateDashboardInput,
): Promise<Dashboard> {
  const dashboardId = randomUUID()
  const now = new Date().toISOString()

  const item: Dashboard = {
    ...dashboardKey(userId, dashboardId),
    userId,
    dashboardId,
    name: input.name,
    cards: input.cards ?? [],
    createdAt: now,
    updatedAt: now,
  }

  // Only include ticker/query when they have values — omit undefined attributes.
  if (input.ticker !== undefined) item.ticker = input.ticker
  if (input.query !== undefined) item.query = input.query

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}

export async function listDashboards(userId: string): Promise<Dashboard[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'DASHBOARD#',
      },
    }),
  )
  const dashboards = Items as Dashboard[]
  // Sort newest first by createdAt (descending).
  return dashboards.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getDashboard(
  userId: string,
  dashboardId: string,
): Promise<Dashboard | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: dashboardKey(userId, dashboardId),
    }),
  )
  return Item ? (Item as Dashboard) : null
}

export async function updateDashboard(
  userId: string,
  dashboardId: string,
  patch: UpdateDashboardPatch,
): Promise<Dashboard | null> {
  const existing = await getDashboard(userId, dashboardId)
  if (!existing) return null

  const updated: Dashboard = { ...existing }

  // Apply only the fields present in patch (fields absent from patch are preserved).
  if (patch.name !== undefined) updated.name = patch.name
  if (patch.ticker !== undefined) updated.ticker = patch.ticker
  if (patch.query !== undefined) updated.query = patch.query
  if (patch.cards !== undefined) updated.cards = patch.cards

  // Always bump updatedAt.
  updated.updatedAt = new Date().toISOString()

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: updated }))
  return updated
}

export async function deleteDashboard(userId: string, dashboardId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: TableNames.userData,
      Key: dashboardKey(userId, dashboardId),
    }),
  )
}
