import { describe, test, expect } from 'vitest'
import { safeRedirectPath } from './redirectDest'

describe('safeRedirectPath', () => {
  test('null / undefined / empty return null', () => {
    expect(safeRedirectPath(null)).toBeNull()
    expect(safeRedirectPath(undefined)).toBeNull()
    expect(safeRedirectPath('')).toBeNull()
    expect(safeRedirectPath('   ')).toBeNull()
  })

  test('root-relative path is returned unchanged', () => {
    expect(safeRedirectPath('/account/billing')).toBe('/account/billing')
  })

  test('query string is preserved', () => {
    expect(safeRedirectPath('/account/billing?plan=pro&interval=month')).toBe(
      '/account/billing?plan=pro&interval=month'
    )
  })

  test('protocol-relative path is rejected', () => {
    expect(safeRedirectPath('//evil.com/x')).toBeNull()
  })

  test('non-relative path is rejected', () => {
    expect(safeRedirectPath('account/billing')).toBeNull()
  })

  test('absolute URL is rejected without a window origin to compare', () => {
    // In the unit-test (node) environment there is no window, so an absolute
    // URL cannot be proven same-origin and is rejected.
    expect(safeRedirectPath('https://evil.com/account/billing')).toBeNull()
  })
})
