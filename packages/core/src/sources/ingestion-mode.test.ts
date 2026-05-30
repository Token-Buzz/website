import { describe, expect, test } from 'vitest'
import {
  DEFAULT_INGESTION_SETTINGS,
  resolveIngestionMode,
  sanitizeIngestionSettings,
  type IngestionSettings,
} from './ingestion-mode'

// ── resolveIngestionMode ──────────────────────────────────────────────────────

describe('resolveIngestionMode', () => {
  test('returns global default when no override for the source', () => {
    const settings: IngestionSettings = { default: 'apify', overrides: {} }
    expect(resolveIngestionMode(settings, 'twitter')).toBe('apify')
  })

  test('returns global default "per-source" when no override', () => {
    expect(resolveIngestionMode(DEFAULT_INGESTION_SETTINGS, 'reddit')).toBe('per-source')
  })

  test('override beats global default for the pinned source', () => {
    const settings: IngestionSettings = {
      default: 'apify',
      overrides: { twitter: 'per-source' },
    }
    expect(resolveIngestionMode(settings, 'twitter')).toBe('per-source')
  })

  test('override only applies to the pinned source, not others', () => {
    const settings: IngestionSettings = {
      default: 'apify',
      overrides: { twitter: 'per-source' },
    }
    // 'farcaster' has no override — should use the global default.
    expect(resolveIngestionMode(settings, 'farcaster')).toBe('apify')
  })

  test('override for one source does not affect another source with its own override', () => {
    const settings: IngestionSettings = {
      default: 'per-source',
      overrides: { twitter: 'apify', reddit: 'per-source' },
    }
    expect(resolveIngestionMode(settings, 'twitter')).toBe('apify')
    expect(resolveIngestionMode(settings, 'reddit')).toBe('per-source')
    expect(resolveIngestionMode(settings, 'telegram')).toBe('per-source')
  })
})

// ── sanitizeIngestionSettings ─────────────────────────────────────────────────

describe('sanitizeIngestionSettings', () => {
  test('valid full settings pass through unchanged', () => {
    const input: IngestionSettings = {
      default: 'apify',
      overrides: { twitter: 'per-source', reddit: 'apify' },
    }
    expect(sanitizeIngestionSettings(input)).toEqual(input)
  })

  test('drops unknown sources from overrides', () => {
    const input = {
      default: 'per-source',
      overrides: { twitter: 'apify', unknownSource: 'apify' },
    }
    expect(sanitizeIngestionSettings(input)).toEqual({
      default: 'per-source',
      overrides: { twitter: 'apify' },
    })
  })

  test('drops invalid mode values from overrides', () => {
    const input = {
      default: 'per-source',
      overrides: { twitter: 'invalid-mode', reddit: 'apify' },
    }
    expect(sanitizeIngestionSettings(input)).toEqual({
      default: 'per-source',
      overrides: { reddit: 'apify' },
    })
  })

  test('invalid default falls back to "per-source"', () => {
    const input = { default: 'bogus', overrides: {} }
    expect(sanitizeIngestionSettings(input)).toEqual({ default: 'per-source', overrides: {} })
  })

  test('null input returns DEFAULT_INGESTION_SETTINGS', () => {
    expect(sanitizeIngestionSettings(null)).toEqual(DEFAULT_INGESTION_SETTINGS)
  })

  test('undefined input returns DEFAULT_INGESTION_SETTINGS', () => {
    expect(sanitizeIngestionSettings(undefined)).toEqual(DEFAULT_INGESTION_SETTINGS)
  })

  test('string input returns DEFAULT_INGESTION_SETTINGS', () => {
    expect(sanitizeIngestionSettings('garbage')).toEqual(DEFAULT_INGESTION_SETTINGS)
  })

  test('number input returns DEFAULT_INGESTION_SETTINGS', () => {
    expect(sanitizeIngestionSettings(42)).toEqual(DEFAULT_INGESTION_SETTINGS)
  })

  test('array input returns DEFAULT_INGESTION_SETTINGS', () => {
    expect(sanitizeIngestionSettings([])).toEqual(DEFAULT_INGESTION_SETTINGS)
  })

  test('empty object returns per-source default with empty overrides', () => {
    expect(sanitizeIngestionSettings({})).toEqual({ default: 'per-source', overrides: {} })
  })

  test('missing overrides field yields empty overrides', () => {
    const input = { default: 'apify' }
    expect(sanitizeIngestionSettings(input)).toEqual({ default: 'apify', overrides: {} })
  })

  test('null overrides field yields empty overrides', () => {
    const input = { default: 'per-source', overrides: null }
    expect(sanitizeIngestionSettings(input)).toEqual({ default: 'per-source', overrides: {} })
  })

  test('drops both unknown source and invalid mode, keeps valid entries', () => {
    const input = {
      default: 'apify',
      overrides: {
        twitter: 'per-source',   // valid
        farcaster: 'bad-mode',   // invalid mode → dropped
        not_a_source: 'apify',   // invalid source → dropped
        discord: 'apify',        // valid
      },
    }
    expect(sanitizeIngestionSettings(input)).toEqual({
      default: 'apify',
      overrides: { twitter: 'per-source', discord: 'apify' },
    })
  })
})
