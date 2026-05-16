import { DeleteCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { alertKey, watchlistGroupKey, watchlistItemKey } from './keys'

export interface WatchlistItem {
  pk: string
  sk: string
  userId: string
  symbol: string
  groupId?: string
  addedAt: string
}

export interface WatchlistGroup {
  pk: string
  sk: string
  userId: string
  groupId: string
  name: string
  color: string
  createdAt: string
}

export interface AlertItem {
  pk: string
  sk: string
  userId: string
  alertId: string
  tone: 'buzz' | 'sent' | 'handle' | 'narrative'
  target: string
  body: string
  tag: string
  createdAt: string
  firedAt?: string
  acknowledged?: boolean
}

export async function getWatchlist(userId: string): Promise<WatchlistItem[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.userData,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'WATCHLIST#',
    },
  }))
  return Items as WatchlistItem[]
}

export async function addToWatchlist(
  userId: string,
  symbol: string,
  groupId?: string,
): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TableNames.userData,
    Item: {
      ...watchlistItemKey(userId, symbol),
      userId,
      symbol: symbol.toUpperCase(),
      groupId,
      addedAt: new Date().toISOString(),
    },
  }))
}

export async function removeFromWatchlist(userId: string, symbol: string): Promise<void> {
  await ddb.send(new DeleteCommand({
    TableName: TableNames.userData,
    Key: watchlistItemKey(userId, symbol),
  }))
}

export async function listWatchlistGroups(userId: string): Promise<WatchlistGroup[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.userData,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'GROUP#',
    },
  }))
  return Items as WatchlistGroup[]
}

export async function createWatchlistGroup(
  userId: string,
  name: string,
  color: string,
): Promise<WatchlistGroup> {
  const groupId = `g_${Date.now()}`
  const item: WatchlistGroup = {
    ...watchlistGroupKey(userId, groupId),
    userId,
    groupId,
    name,
    color,
    createdAt: new Date().toISOString(),
  }
  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}

export async function getAlerts(userId: string): Promise<AlertItem[]> {
  const { Items = [] } = await ddb.send(new QueryCommand({
    TableName: TableNames.userData,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'ALERT#',
    },
    ScanIndexForward: false,
  }))
  return Items as AlertItem[]
}

export async function createAlert(
  userId: string,
  alert: Pick<AlertItem, 'tone' | 'target' | 'body' | 'tag'>,
): Promise<AlertItem> {
  const alertId = `alert_${Date.now()}`
  const item: AlertItem = {
    ...alertKey(userId, alertId),
    userId,
    alertId,
    ...alert,
    createdAt: new Date().toISOString(),
  }
  await ddb.send(new PutCommand({ TableName: TableNames.userData, Item: item }))
  return item
}
