/**
 * Notification preferences data layer.
 * Stores and retrieves per-user email notification opt-in settings.
 *
 * Key builders live in keys.ts; never inline pk/sk here.
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { notificationPrefsKey } from './keys'

export interface NotificationPrefs {
  emailAlerts: boolean
}

/**
 * Returns the user's notification preferences.
 * Defaults to { emailAlerts: false } (opt-in) if no record exists.
 */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: notificationPrefsKey(userId),
    }),
  )
  if (!Item) return { emailAlerts: false }
  return { emailAlerts: Boolean(Item.emailAlerts) }
}

/**
 * Persists the user's notification preferences.
 */
export async function setNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: {
        ...notificationPrefsKey(userId),
        emailAlerts: prefs.emailAlerts,
        updatedAt: new Date().toISOString(),
      },
    }),
  )
}
