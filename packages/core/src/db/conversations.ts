/**
 * Hum AI conversation + message persistence in the UserData table.
 *
 * Conversation-metadata rows:
 *   pk = USER#<userId>
 *   sk = CONV#<conversationId>
 *
 * Message rows:
 *   pk = USER#<userId>
 *   sk = MSG#<conversationId>#<timestamp>   ← ISO timestamp → lexicographic = chronological
 *
 * The `CONV#` prefix and `MSG#` prefix are entirely DISJOINT (neither is a
 * prefix of the other), so begins_with(sk,'CONV#') lists only conversation
 * metadata rows, and begins_with(sk,'MSG#<id>#') lists only that conversation's
 * messages. This mirrors the ALERT#/TRIGGER# split in alerts.ts.
 */

import { randomUUID } from 'node:crypto'
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { conversationKey, conversationMessageKey } from './keys'

// ── Types ────────────────────────────────────────────────────────────────────

export type HumRole = 'user' | 'assistant'

/** Open shape — Phase 3 (drag-in context) defines this fully. Phase 1 persists it opaquely if provided. */
export interface HumContextItem {
  type: string
  label?: string
  [key: string]: unknown
}

export interface Conversation {
  pk: string
  sk: string
  userId: string
  conversationId: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
  preview?: string
}

export interface ConversationMessage {
  pk: string
  sk: string
  userId: string
  conversationId: string
  timestamp: string
  role: HumRole
  text: string
  contextItems?: HumContextItem[]
  model?: string
  tokensIn?: number
  tokensOut?: number
}

// ── CRUD functions ───────────────────────────────────────────────────────────

/**
 * Creates a new conversation for the given user. Generates a UUID for the
 * conversationId, sets title to input?.title ?? 'New chat', and initializes
 * messageCount to 0. Returns the full Conversation item.
 */
export async function createConversation(
  userId: string,
  input?: { title?: string },
): Promise<Conversation> {
  const conversationId = randomUUID()
  const now = new Date().toISOString()

  const item: Conversation = {
    ...conversationKey(userId, conversationId),
    userId,
    conversationId,
    title: input?.title ?? 'New chat',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  }

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}

/**
 * Returns all conversations for the given user, sorted by updatedAt DESC
 * (most recently active first).
 */
export async function listConversations(userId: string): Promise<Conversation[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'CONV#',
      },
    }),
  )
  const conversations = Items as Conversation[]
  // Sort newest activity first by updatedAt (descending).
  return conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * Retrieves a single conversation by userId and conversationId. Returns null
 * if not found.
 */
export async function getConversation(
  userId: string,
  conversationId: string,
): Promise<Conversation | null> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: conversationKey(userId, conversationId),
    }),
  )
  return Item ? (Item as Conversation) : null
}

/**
 * Returns all messages for a conversation in chronological order (ascending
 * by ISO timestamp, which is the default ScanIndexForward:true behaviour).
 * The begins_with prefix `MSG#<conversationId>#` is disjoint from `CONV#`
 * metadata rows and from other conversations' message rows.
 */
export async function getMessages(
  userId: string,
  conversationId: string,
): Promise<ConversationMessage[]> {
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TableNames.userData,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': `MSG#${conversationId}#`,
      },
    }),
  )
  return Items as ConversationMessage[]
}

/**
 * Appends a message to a conversation. Accepts an optional explicit `timestamp`
 * (useful in tests to guarantee distinct ordering); defaults to now.
 *
 * After writing the message row, bumps the parent conversation's messageCount
 * by 1 and advances updatedAt via a conditional UpdateCommand. Swallows
 * ConditionalCheckFailedException so that a message appended to a deleted
 * conversation is still persisted (the message row is always written).
 *
 * Returns the full ConversationMessage item.
 */
export async function appendMessage(
  userId: string,
  conversationId: string,
  msg: {
    role: HumRole
    text: string
    contextItems?: HumContextItem[]
    model?: string
    tokensIn?: number
    tokensOut?: number
    timestamp?: string
  },
): Promise<ConversationMessage> {
  const timestamp = msg.timestamp ?? new Date().toISOString()
  // updatedAt always reflects real wall-clock time so the conversation list
  // sorts by actual activity time, not by the message's logical timestamp.
  const updatedAt = new Date().toISOString()

  const item: ConversationMessage = {
    ...conversationMessageKey(userId, conversationId, timestamp),
    userId,
    conversationId,
    timestamp,
    role: msg.role,
    text: msg.text,
  }

  // Only include optional attributes when they have values — omit undefined attributes.
  if (msg.contextItems !== undefined) item.contextItems = msg.contextItems
  if (msg.model !== undefined) item.model = msg.model
  if (msg.tokensIn !== undefined) item.tokensIn = msg.tokensIn
  if (msg.tokensOut !== undefined) item.tokensOut = msg.tokensOut

  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))

  // Bump messageCount, advance updatedAt, and store a preview snippet on the
  // parent conversation. Swallow ConditionalCheckFailedException so a trigger
  // for a deleted conversation still writes the message row above (best-effort
  // parent update).
  const preview = msg.text.slice(0, 140)
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TableNames.userData,
        Key: conversationKey(userId, conversationId),
        UpdateExpression: 'ADD messageCount :one SET updatedAt = :now, preview = :preview',
        ConditionExpression: 'attribute_exists(pk)',
        ExpressionAttributeValues: {
          ':one': 1,
          ':now': updatedAt,
          ':preview': preview,
        },
      }),
    )
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      // Conversation was deleted — message row already written; proceed.
    } else {
      throw err
    }
  }

  return item
}
