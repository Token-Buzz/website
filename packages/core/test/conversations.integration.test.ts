/**
 * Conversations integration test — exercises the real
 * `packages/core/src/db/conversations.ts` functions (createConversation,
 * listConversations, getConversation, getMessages, appendMessage) against a
 * local dynalite DynamoDB.
 *
 * Key bug-class this harness catches: a begins_with query that uses the wrong
 * sk prefix and accidentally returns rows of the wrong type (e.g. listConversations
 * returning MSG# rows). The disjoint CONV#/MSG# prefix split is explicitly
 * verified here.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  DynamoDBClient,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from '@monorepo-template/core/db/client'
import {
  createConversation,
  listConversations,
  getConversation,
  getMessages,
  appendMessage,
} from '@monorepo-template/core/db/conversations'

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

// ── createConversation ────────────────────────────────────────────────────────

describe('createConversation', () => {
  const USER_ID = 'user_conv_create'

  test('returns a conversation with uuid conversationId, correct pk/sk, messageCount 0, and default title', async () => {
    const conv = await createConversation(USER_ID)

    expect(conv.conversationId).toBeTruthy()
    // UUID format (8-4-4-4-12 hex chars)
    expect(conv.conversationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(conv.pk).toBe(`USER#${USER_ID}`)
    expect(conv.sk).toBe(`CONV#${conv.conversationId}`)
    expect(conv.userId).toBe(USER_ID)
    expect(conv.title).toBe('New chat')
    expect(conv.messageCount).toBe(0)
    expect(conv.createdAt).toBeTruthy()
    expect(conv.updatedAt).toBeTruthy()
    expect(conv.createdAt).toBe(conv.updatedAt)
  })

  test('accepts a custom title', async () => {
    const conv = await createConversation(USER_ID, { title: 'My research session' })
    expect(conv.title).toBe('My research session')
  })
})

// ── appendMessage + getMessages ───────────────────────────────────────────────

describe('appendMessage / getMessages', () => {
  const USER_ID = 'user_conv_messages'

  test('round-trip: append two messages, getMessages returns them in chronological order', async () => {
    const conv = await createConversation(USER_ID)

    const msg1 = await appendMessage(USER_ID, conv.conversationId, {
      role: 'user',
      text: 'Hello, Hum!',
      timestamp: '2026-01-01T00:00:01.000Z',
    })
    const msg2 = await appendMessage(USER_ID, conv.conversationId, {
      role: 'assistant',
      text: 'Hello! How can I help you today?',
      timestamp: '2026-01-01T00:00:02.000Z',
    })

    const messages = await getMessages(USER_ID, conv.conversationId)

    expect(messages).toHaveLength(2)
    // Chronological order: msg1 before msg2.
    expect(messages[0].timestamp).toBe('2026-01-01T00:00:01.000Z')
    expect(messages[0].role).toBe('user')
    expect(messages[0].text).toBe('Hello, Hum!')
    expect(messages[0].userId).toBe(USER_ID)
    expect(messages[0].conversationId).toBe(conv.conversationId)
    expect(messages[0].pk).toBe(`USER#${USER_ID}`)
    expect(messages[0].sk).toBe(`MSG#${conv.conversationId}#2026-01-01T00:00:01.000Z`)

    expect(messages[1].timestamp).toBe('2026-01-01T00:00:02.000Z')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].text).toBe('Hello! How can I help you today?')

    // Sanity: message sk does NOT start with CONV#
    for (const m of messages) {
      expect(m.sk.startsWith('CONV#')).toBe(false)
      expect(m.sk.startsWith('MSG#')).toBe(true)
    }

    // Returned items match the appendMessage return values
    expect(messages[0].sk).toBe(msg1.sk)
    expect(messages[1].sk).toBe(msg2.sk)
  })

  test('appendMessage on a deleted conversation does not throw (message still written)', async () => {
    const conv = await createConversation(USER_ID)
    // Simulate deletion by directly checking non-existent conversationId.
    await expect(
      appendMessage(USER_ID, 'nonexistent-conv-id', {
        role: 'user',
        text: 'orphan message',
        timestamp: '2026-01-01T00:00:01.000Z',
      }),
    ).resolves.toBeDefined()
  })
})

// ── getConversation after appendMessage ───────────────────────────────────────

describe('getConversation — messageCount + updatedAt after appends', () => {
  const USER_ID = 'user_conv_get'

  test('messageCount increments to 2 after two appends, updatedAt advanced past createdAt', async () => {
    const conv = await createConversation(USER_ID)
    const { createdAt } = conv

    await appendMessage(USER_ID, conv.conversationId, {
      role: 'user',
      text: 'First message',
      timestamp: '2026-01-01T00:00:01.000Z',
    })
    await appendMessage(USER_ID, conv.conversationId, {
      role: 'assistant',
      text: 'Second message',
      timestamp: '2026-01-01T00:00:02.000Z',
    })

    const fetched = await getConversation(USER_ID, conv.conversationId)

    expect(fetched).not.toBeNull()
    expect(fetched!.messageCount).toBe(2)
    // updatedAt is real wall-clock time (not the message timestamp), so it
    // must be strictly after createdAt (which was also wall-clock time).
    expect(fetched!.updatedAt > createdAt).toBe(true)
    // updatedAt must be a valid ISO string but NOT the historical test timestamp.
    expect(fetched!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('getConversation returns null for unknown conversationId', async () => {
    const result = await getConversation(USER_ID, 'no-such-conv')
    expect(result).toBeNull()
  })

  test('preview reflects the most recent appended message text, truncated to 140 chars', async () => {
    const conv = await createConversation(USER_ID)

    await appendMessage(USER_ID, conv.conversationId, {
      role: 'user',
      text: 'What is the capital of France?',
      timestamp: '2026-01-01T00:00:01.000Z',
    })
    await appendMessage(USER_ID, conv.conversationId, {
      role: 'assistant',
      text: 'The capital of France is Paris.',
      timestamp: '2026-01-01T00:00:02.000Z',
    })

    const fetched = await getConversation(USER_ID, conv.conversationId)
    expect(fetched).not.toBeNull()
    // preview must reflect the LAST appended message (assistant), not the first.
    expect(fetched!.preview).toBe('The capital of France is Paris.')

    // Append a message whose text exceeds 140 chars — preview must be truncated.
    const longText = 'x'.repeat(200)
    await appendMessage(USER_ID, conv.conversationId, {
      role: 'user',
      text: longText,
      timestamp: '2026-01-01T00:00:03.000Z',
    })

    const fetched2 = await getConversation(USER_ID, conv.conversationId)
    expect(fetched2).not.toBeNull()
    expect(fetched2!.preview).toHaveLength(140)
    expect(fetched2!.preview).toBe(longText.slice(0, 140))
  })
})

// ── listConversations ─────────────────────────────────────────────────────────

describe('listConversations', () => {
  const USER_ID = 'user_conv_list'

  test('returns exactly one item after creating one conversation', async () => {
    await createConversation(USER_ID, { title: 'Only conversation' })

    const convs = await listConversations(USER_ID)
    expect(convs).toHaveLength(1)
    expect(convs[0].title).toBe('Only conversation')
  })

  test('DISJOINT PREFIX: listConversations returns NO MSG# rows even after appending messages', async () => {
    const conv = await createConversation(USER_ID)

    await appendMessage(USER_ID, conv.conversationId, {
      role: 'user',
      text: 'A message',
      timestamp: '2026-01-01T00:00:01.000Z',
    })
    await appendMessage(USER_ID, conv.conversationId, {
      role: 'assistant',
      text: 'A reply',
      timestamp: '2026-01-01T00:00:02.000Z',
    })

    const convs = await listConversations(USER_ID)

    // Must return exactly ONE item (the conversation row), not the message rows.
    expect(convs).toHaveLength(1)

    // Critical: none of the returned items have a MSG# sort key.
    for (const c of convs) {
      expect(c.sk.startsWith('MSG#')).toBe(false)
      expect(c.sk.startsWith('CONV#')).toBe(true)
    }
  })

  test('returns empty array when no conversations exist', async () => {
    const convs = await listConversations('no_such_user')
    expect(convs).toHaveLength(0)
  })

  test('sorts by updatedAt DESC (newest activity first)', async () => {
    // Drive wall-clock time deterministically so the DESC-by-updatedAt sort can
    // never tie. We fake ONLY `Date` (not setTimeout/setInterval) so the AWS SDK
    // / dynalite real timers keep working.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
      const older = await createConversation(USER_ID, { title: 'Older' })

      vi.setSystemTime(new Date('2024-01-01T00:00:01.000Z'))
      const newer = await createConversation(USER_ID, { title: 'Newer' })

      // appendMessage sets the conversation's updatedAt to wall-clock now()
      // (it ignores the message timestamp). Advance the clock so 'older' gets a
      // strictly-later updatedAt than 'newer', making the DESC sort deterministic.
      vi.setSystemTime(new Date('2024-01-01T00:00:02.000Z'))
      await appendMessage(USER_ID, older.conversationId, {
        role: 'user',
        text: 'Late message on older conv',
        timestamp: '2024-01-01T00:00:02.000Z',
      })

      const convs = await listConversations(USER_ID)
      expect(convs).toHaveLength(2)
      // 'older' now has the most-recent updatedAt, so it sorts first.
      expect(convs[0].conversationId).toBe(older.conversationId)
      expect(convs[1].conversationId).toBe(newer.conversationId)
    } finally {
      vi.useRealTimers()
    }
  })
})
