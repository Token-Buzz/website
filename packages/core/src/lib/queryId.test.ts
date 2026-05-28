import { describe, expect, test } from 'vitest'
import { encodeQueryId, decodeQueryId } from './queryId'

const VALID_SUBMITTED_AT = '2026-05-28T19:27:00.000Z'
const VALID_HASH = 'a1b2c3d4e5f6a7b8'

describe('encodeQueryId', () => {
  test('produces <submittedAt>_<queryHash>', () => {
    expect(encodeQueryId(VALID_SUBMITTED_AT, VALID_HASH)).toBe(
      `${VALID_SUBMITTED_AT}_${VALID_HASH}`,
    )
  })
})

describe('decodeQueryId', () => {
  test('round-trips a valid encode', () => {
    const encoded = encodeQueryId(VALID_SUBMITTED_AT, VALID_HASH)
    expect(decodeQueryId(encoded)).toEqual({
      submittedAt: VALID_SUBMITTED_AT,
      queryHash: VALID_HASH,
    })
  })

  test('splits on the LAST underscore so ISO timestamps with colons work', () => {
    // submittedAt contains colons but no underscores; the only underscore is the separator
    const encoded = `2026-05-28T19:27:00.000Z_${VALID_HASH}`
    const result = decodeQueryId(encoded)
    expect(result).not.toBeNull()
    expect(result!.submittedAt).toBe('2026-05-28T19:27:00.000Z')
    expect(result!.queryHash).toBe(VALID_HASH)
  })

  test('returns null when there is no underscore', () => {
    expect(decodeQueryId('nounderscore')).toBeNull()
  })

  test('returns null when submittedAt is empty (leading underscore)', () => {
    expect(decodeQueryId(`_${VALID_HASH}`)).toBeNull()
  })

  test('returns null when queryHash is empty (trailing underscore)', () => {
    expect(decodeQueryId(`${VALID_SUBMITTED_AT}_`)).toBeNull()
  })

  test('returns null when queryHash is not 16 hex chars (too short)', () => {
    expect(decodeQueryId(`${VALID_SUBMITTED_AT}_a1b2c3d4`)).toBeNull()
  })

  test('returns null when queryHash contains non-hex chars', () => {
    expect(decodeQueryId(`${VALID_SUBMITTED_AT}_a1b2c3d4e5f6g7h8`)).toBeNull()
  })

  test('returns null for empty string', () => {
    expect(decodeQueryId('')).toBeNull()
  })
})
