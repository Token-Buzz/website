import { describe, test, expect } from 'vitest'
import { swatchForId } from './commandSwatch'

const SWATCH_COLORS = [
  'var(--buzz-500)', '#6E5BA3', '#2E7F7B', '#B8527E', '#C68A2E', '#3B7DD8',
]

describe('swatchForId', () => {
  test('is deterministic — same id returns same color across calls', () => {
    const id = 'abc-123-uuid'
    expect(swatchForId(id)).toBe(swatchForId(id))
  })

  test('returned color is always one of the palette', () => {
    const ids = ['', 'abc', 'xyz-000', '1234567890', 'some-dashboard-id-with-hyphens']
    for (const id of ids) {
      expect(SWATCH_COLORS).toContain(swatchForId(id))
    }
  })

  test('two different ids can map to different colors', () => {
    const results = new Set(SWATCH_COLORS.map((_, i) => swatchForId(`id-${i * 999}`)))
    expect(results.size).toBeGreaterThan(1)
  })

  test('empty string returns a valid palette color', () => {
    expect(SWATCH_COLORS).toContain(swatchForId(''))
  })
})
