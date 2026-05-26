/**
 * Dashboard integration test — exercises the real `packages/core/src/db/dashboards.ts`
 * functions (createDashboard, listDashboards, getDashboard, updateDashboard, deleteDashboard)
 * against a local dynalite DynamoDB. No mocking of ddb — every test is a real
 * write→read round-trip.
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
  createDashboard,
  listDashboards,
  getDashboard,
  updateDashboard,
  deleteDashboard,
  type DashboardCard,
} from '@monorepo-template/core/db/dashboards'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dashboard DB layer (dynalite integration)', () => {
  const USER_ID = 'user_dash_test_123'

  // ── createDashboard ───────────────────────────────────────────────────────

  describe('createDashboard', () => {
    test('returns a dashboard with uuid dashboardId, correct pk/sk, timestamps, and empty cards', async () => {
      const before = new Date().toISOString()
      const dashboard = await createDashboard(USER_ID, { name: 'My Dashboard' })
      const after = new Date().toISOString()

      // UUID shape (v4)
      expect(dashboard.dashboardId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )

      // Correct pk/sk
      expect(dashboard.pk).toBe(`USER#${USER_ID}`)
      expect(dashboard.sk).toBe(`DASHBOARD#${dashboard.dashboardId}`)

      // userId and name
      expect(dashboard.userId).toBe(USER_ID)
      expect(dashboard.name).toBe('My Dashboard')

      // cards defaults to empty array
      expect(dashboard.cards).toEqual([])

      // timestamps are set and within the test window
      expect(dashboard.createdAt >= before).toBe(true)
      expect(dashboard.createdAt <= after).toBe(true)
      expect(dashboard.updatedAt).toBe(dashboard.createdAt)
    })

    test('ticker and query are included when provided', async () => {
      const dashboard = await createDashboard(USER_ID, {
        name: 'BTC Dashboard',
        ticker: 'BTC',
        query: 'bitcoin',
      })

      expect(dashboard.ticker).toBe('BTC')
      expect(dashboard.query).toBe('bitcoin')
    })

    test('ticker and query are omitted entirely when not provided', async () => {
      const dashboard = await createDashboard(USER_ID, { name: 'No Ticker' })

      // Must not have the keys at all (not set to undefined)
      expect('ticker' in dashboard).toBe(false)
      expect('query' in dashboard).toBe(false)
    })

    test('cards can be provided at create time', async () => {
      const card: DashboardCard = {
        id: 'card-1',
        type: 'mentions',
        position: { x: 0, y: 0, w: 4, h: 3 },
        options: {},
      }
      const dashboard = await createDashboard(USER_ID, {
        name: 'With Cards',
        cards: [card],
      })

      expect(dashboard.cards).toHaveLength(1)
      expect(dashboard.cards[0]).toEqual(card)
    })
  })

  // ── getDashboard ──────────────────────────────────────────────────────────

  describe('getDashboard', () => {
    test('returns the created dashboard by id', async () => {
      const created = await createDashboard(USER_ID, { name: 'Fetch Me' })

      const fetched = await getDashboard(USER_ID, created.dashboardId)

      expect(fetched).not.toBeNull()
      expect(fetched!.dashboardId).toBe(created.dashboardId)
      expect(fetched!.name).toBe('Fetch Me')
      expect(fetched!.pk).toBe(created.pk)
      expect(fetched!.sk).toBe(created.sk)
    })

    test('returns null for a missing id', async () => {
      const result = await getDashboard(USER_ID, 'nonexistent-uuid-0000')
      expect(result).toBeNull()
    })

    test('is user-scoped — does not return another user\'s dashboard', async () => {
      const created = await createDashboard(USER_ID, { name: 'Owner Only' })
      const result = await getDashboard('other_user', created.dashboardId)
      expect(result).toBeNull()
    })
  })

  // ── listDashboards ────────────────────────────────────────────────────────

  describe('listDashboards', () => {
    test('returns dashboards for the user', async () => {
      await createDashboard(USER_ID, { name: 'First' })
      const results = await listDashboards(USER_ID)
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('First')
    })

    test('returns empty array when no dashboards exist', async () => {
      const results = await listDashboards('user_with_no_dashboards')
      expect(results).toEqual([])
    })

    test('returns only dashboards belonging to the queried user (isolation)', async () => {
      const OTHER_USER = 'user_other_456'
      await createDashboard(USER_ID, { name: 'User A Dashboard 1' })
      // Small delay to ensure distinct createdAt values for ordering test
      await new Promise((r) => setTimeout(r, 2))
      await createDashboard(USER_ID, { name: 'User A Dashboard 2' })
      await createDashboard(OTHER_USER, { name: 'User B Dashboard' })

      const results = await listDashboards(USER_ID)
      expect(results).toHaveLength(2)
      results.forEach((d) => expect(d.userId).toBe(USER_ID))
    })

    test('returns dashboards sorted newest first (descending createdAt)', async () => {
      const first = await createDashboard(USER_ID, { name: 'Older' })
      await new Promise((r) => setTimeout(r, 2))
      const second = await createDashboard(USER_ID, { name: 'Newer' })

      const results = await listDashboards(USER_ID)
      expect(results).toHaveLength(2)
      // Newest first
      expect(results[0].dashboardId).toBe(second.dashboardId)
      expect(results[1].dashboardId).toBe(first.dashboardId)
    })
  })

  // ── updateDashboard ───────────────────────────────────────────────────────

  describe('updateDashboard', () => {
    test('partial update — name changes, other fields preserved', async () => {
      const created = await createDashboard(USER_ID, {
        name: 'Original Name',
        query: 'bitcoin',
      })

      await new Promise((r) => setTimeout(r, 2))
      const updated = await updateDashboard(USER_ID, created.dashboardId, {
        name: 'renamed',
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe('renamed')
      // query must be preserved
      expect(updated!.query).toBe('bitcoin')
      // updatedAt must have advanced past createdAt
      expect(updated!.updatedAt > created.createdAt).toBe(true)
    })

    test('patching only cards leaves name and query intact', async () => {
      const created = await createDashboard(USER_ID, {
        name: 'Card Test',
        query: 'ethereum',
      })

      const oneCard: DashboardCard = {
        id: 'c1',
        type: 'sentiment',
        position: { x: 0, y: 0, w: 6, h: 4 },
        options: { timeWindow: '24H' },
      }

      const updated = await updateDashboard(USER_ID, created.dashboardId, {
        cards: [oneCard],
      })

      expect(updated).not.toBeNull()
      expect(updated!.cards).toHaveLength(1)
      expect(updated!.cards[0].id).toBe('c1')
      // name and query must still be intact
      expect(updated!.name).toBe('Card Test')
      expect(updated!.query).toBe('ethereum')
    })

    test('updated item is persisted — getDashboard reflects the change', async () => {
      const created = await createDashboard(USER_ID, { name: 'Before' })
      await updateDashboard(USER_ID, created.dashboardId, { name: 'After' })

      const fetched = await getDashboard(USER_ID, created.dashboardId)
      expect(fetched!.name).toBe('After')
    })

    test('returns null when dashboardId does not exist', async () => {
      const result = await updateDashboard(USER_ID, 'no-such-id-0000', { name: 'x' })
      expect(result).toBeNull()
    })
  })

  // ── deleteDashboard ───────────────────────────────────────────────────────

  describe('deleteDashboard', () => {
    test('delete removes the item so getDashboard returns null', async () => {
      const created = await createDashboard(USER_ID, { name: 'To Delete' })

      await deleteDashboard(USER_ID, created.dashboardId)

      const fetched = await getDashboard(USER_ID, created.dashboardId)
      expect(fetched).toBeNull()
    })

    test('delete removes only the targeted dashboard', async () => {
      const first = await createDashboard(USER_ID, { name: 'Keep' })
      const second = await createDashboard(USER_ID, { name: 'Remove' })

      await deleteDashboard(USER_ID, second.dashboardId)

      const remaining = await listDashboards(USER_ID)
      expect(remaining).toHaveLength(1)
      expect(remaining[0].dashboardId).toBe(first.dashboardId)
    })

    test('deleting a non-existent item does not throw', async () => {
      await expect(deleteDashboard(USER_ID, 'no-such-id-9999')).resolves.toBeUndefined()
    })
  })
})
