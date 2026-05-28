import { describe, it, expect } from 'vitest'
import { downgradeEmailSubject, buildDowngradeEmailHtml } from './_email'

describe('downgradeEmailSubject', () => {
  it('returns the exact subject string', () => {
    expect(downgradeEmailSubject()).toBe('Your TokenBuzz subscription has ended')
  })
})

describe('buildDowngradeEmailHtml', () => {
  it('contains the account URL for a given domain', () => {
    const html = buildDowngradeEmailHtml('staging.tokenbuzz.app')
    expect(html).toContain('https://app.staging.tokenbuzz.app/account')
  })

  it('falls back to tokenbuzz.app when domain is undefined', () => {
    const html = buildDowngradeEmailHtml(undefined)
    expect(html).toContain('https://app.tokenbuzz.app/account')
  })
})
