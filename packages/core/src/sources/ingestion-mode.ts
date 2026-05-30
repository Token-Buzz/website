import type { SocialSource } from './types'
import { isSocialSource } from './types'

export type IngestionMode = 'per-source' | 'apify'

export interface IngestionSettings {
  /** Global default mode applied to any source without an explicit override. */
  default: IngestionMode
  /** Per-source pins that override the global default. */
  overrides: Partial<Record<SocialSource, IngestionMode>>
}

export const DEFAULT_INGESTION_SETTINGS: IngestionSettings = { default: 'per-source', overrides: {} }

const VALID_MODES: ReadonlySet<string> = new Set<IngestionMode>(['per-source', 'apify'])

function isIngestionMode(x: unknown): x is IngestionMode {
  return typeof x === 'string' && VALID_MODES.has(x)
}

/** Resolve the effective mode for a source: per-source override if set, else the global default. */
export function resolveIngestionMode(settings: IngestionSettings, source: SocialSource): IngestionMode {
  return settings.overrides[source] ?? settings.default
}

/**
 * Coerce arbitrary input into a valid IngestionSettings, dropping unknown sources/modes.
 * Falls back to DEFAULT_INGESTION_SETTINGS for invalid shapes.
 */
export function sanitizeIngestionSettings(input: unknown): IngestionSettings {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return DEFAULT_INGESTION_SETTINGS
  }

  const raw = input as Record<string, unknown>

  const defaultMode: IngestionMode = isIngestionMode(raw.default) ? raw.default : 'per-source'

  const overrides: Partial<Record<SocialSource, IngestionMode>> = {}
  if (raw.overrides !== null && typeof raw.overrides === 'object' && !Array.isArray(raw.overrides)) {
    for (const [key, value] of Object.entries(raw.overrides as Record<string, unknown>)) {
      if (isSocialSource(key) && isIngestionMode(value)) {
        overrides[key] = value
      }
    }
  }

  return { default: defaultMode, overrides }
}
