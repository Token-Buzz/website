/**
 * Ingestion-mode settings data layer.
 * Stores and retrieves per-user ingestion mode configuration.
 *
 * Key builders live in keys.ts; never inline pk/sk here.
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ddb, TableNames } from './client'
import { ingestionSettingsKey } from './keys'
import {
  type IngestionSettings,
  DEFAULT_INGESTION_SETTINGS,
  sanitizeIngestionSettings,
} from '../sources/ingestion-mode'

/**
 * Returns the user's ingestion settings, or DEFAULT_INGESTION_SETTINGS when none stored.
 * Result is always sanitized.
 */
export async function getIngestionSettings(userId: string): Promise<IngestionSettings> {
  const { Item } = await ddb.send(
    new GetCommand({
      TableName: TableNames.userData,
      Key: ingestionSettingsKey(userId),
    }),
  )
  if (!Item) return DEFAULT_INGESTION_SETTINGS
  return sanitizeIngestionSettings({ default: Item.default, overrides: Item.overrides })
}

/**
 * Persists the user's ingestion settings (sanitized before write) with an updatedAt ISO stamp.
 */
export async function setIngestionSettings(userId: string, settings: IngestionSettings): Promise<void> {
  const sanitized = sanitizeIngestionSettings(settings)
  await ddb.send(
    new PutCommand({
      TableName: TableNames.userData,
      Item: {
        ...ingestionSettingsKey(userId),
        userId,
        default: sanitized.default,
        overrides: sanitized.overrides,
        updatedAt: new Date().toISOString(),
      },
    }),
  )
}
