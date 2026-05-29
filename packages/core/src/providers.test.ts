import { describe, it, expect } from 'vitest'
import { getProvider, isEnabledProvider, TWITTER_PROVIDER, TELEGRAM_PROVIDER, PROVIDERS } from './providers'

describe('providers registry', () => {
  it('TWITTER_PROVIDER equals "twitter"', () => {
    expect(TWITTER_PROVIDER).toBe('twitter')
  })

  it('TELEGRAM_PROVIDER equals "telegram"', () => {
    expect(TELEGRAM_PROVIDER).toBe('telegram')
  })

  it('PROVIDERS.twitter is enabled', () => {
    expect(PROVIDERS.twitter.enabled).toBe(true)
  })

  it('PROVIDERS.telegram is enabled and named "Telegram"', () => {
    expect(PROVIDERS.telegram.enabled).toBe(true)
    expect(PROVIDERS.telegram.name).toBe('Telegram')
  })

  describe('getProvider', () => {
    it('returns the twitter entry for "twitter"', () => {
      const p = getProvider('twitter')
      expect(p).toBeDefined()
      expect(p!.id).toBe('twitter')
      expect(p!.name).toBe('twitterapi.io')
      expect(p!.enabled).toBe(true)
    })

    it('returns undefined for an unknown id', () => {
      expect(getProvider('unknown')).toBeUndefined()
    })

    it('returns undefined for an empty string', () => {
      expect(getProvider('')).toBeUndefined()
    })

    it('returns the telegram entry for "telegram"', () => {
      const p = getProvider('telegram')
      expect(p).toBeDefined()
      expect(p!.id).toBe('telegram')
      expect(p!.name).toBe('Telegram')
      expect(p!.enabled).toBe(true)
    })
  })

  describe('isEnabledProvider', () => {
    it('returns true for "twitter"', () => {
      expect(isEnabledProvider('twitter')).toBe(true)
    })

    it('returns true for "telegram"', () => {
      expect(isEnabledProvider('telegram')).toBe(true)
    })

    it('returns false for "discord"', () => {
      expect(isEnabledProvider('discord')).toBe(false)
    })

    it('returns false for an empty string', () => {
      expect(isEnabledProvider('')).toBe(false)
    })
  })
})
