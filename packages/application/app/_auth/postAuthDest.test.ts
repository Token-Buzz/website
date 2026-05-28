import { describe, test, expect } from 'vitest'
import { postAuthDest } from './postAuthDest'

describe('postAuthDest', () => {
  test('null returns /dashboard', () => {
    expect(postAuthDest(null)).toBe('/dashboard')
  })

  test('undefined returns /dashboard', () => {
    expect(postAuthDest(undefined)).toBe('/dashboard')
  })

  test('empty string returns /dashboard', () => {
    expect(postAuthDest('')).toBe('/dashboard')
  })

  test('PEPE returns /watchlist?focus=PEPE', () => {
    expect(postAuthDest('PEPE')).toBe('/watchlist?focus=PEPE')
  })

  test('lowercase wif is uppercased to WIF', () => {
    expect(postAuthDest('wif')).toBe('/watchlist?focus=WIF')
  })

  test('junk chars are stripped: "so l!@#" -> /watchlist?focus=SOL', () => {
    expect(postAuthDest('so l!@#')).toBe('/watchlist?focus=SOL')
  })

  test('string of only junk chars returns /dashboard', () => {
    expect(postAuthDest('!!!')).toBe('/dashboard')
  })

  test('over-length input is capped to 16 chars', () => {
    const longInput = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const result = postAuthDest(longInput)
    const focusParam = new URLSearchParams(result.split('?')[1]).get('focus')
    expect(focusParam).toBe('ABCDEFGHIJKLMNOP')
    expect(focusParam?.length).toBe(16)
  })
})
