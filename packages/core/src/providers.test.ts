import { describe, it, expect } from 'vitest'
import {
  getProvider,
  isEnabledProvider,
  TWITTER_PROVIDER,
  TELEGRAM_PROVIDER,
  DISCORD_PROVIDER,
  CRYPTOPANIC_PROVIDER,
  CRYPTOCOMPARE_PROVIDER,
  PROVIDERS,
} from './providers'

describe('providers registry', () => {
  it('TWITTER_PROVIDER equals "twitter"', () => {
    expect(TWITTER_PROVIDER).toBe('twitter')
  })

  it('TELEGRAM_PROVIDER equals "telegram"', () => {
    expect(TELEGRAM_PROVIDER).toBe('telegram')
  })

  it('DISCORD_PROVIDER equals "discord"', () => {
    expect(DISCORD_PROVIDER).toBe('discord')
  })

  it('CRYPTOPANIC_PROVIDER equals "cryptopanic"', () => {
    expect(CRYPTOPANIC_PROVIDER).toBe('cryptopanic')
  })

  it('CRYPTOCOMPARE_PROVIDER equals "cryptocompare"', () => {
    expect(CRYPTOCOMPARE_PROVIDER).toBe('cryptocompare')
  })

  it('PROVIDERS.twitter is enabled', () => {
    expect(PROVIDERS.twitter.enabled).toBe(true)
  })

  it('PROVIDERS.twitter has category "social"', () => {
    expect(PROVIDERS.twitter.category).toBe('social')
  })

  it('PROVIDERS.telegram is enabled and named "Telegram"', () => {
    expect(PROVIDERS.telegram.enabled).toBe(true)
    expect(PROVIDERS.telegram.name).toBe('Telegram')
  })

  it('PROVIDERS.telegram has category "social"', () => {
    expect(PROVIDERS.telegram.category).toBe('social')
  })

  it('PROVIDERS.reddit has category "social"', () => {
    expect(PROVIDERS.reddit.category).toBe('social')
  })

  it('PROVIDERS.discord is enabled and named "Discord"', () => {
    expect(PROVIDERS.discord.enabled).toBe(true)
    expect(PROVIDERS.discord.name).toBe('Discord')
  })

  it('PROVIDERS.discord has category "social"', () => {
    expect(PROVIDERS.discord.category).toBe('social')
  })

  it('PROVIDERS.apify has category "apify"', () => {
    expect(PROVIDERS.apify.category).toBe('apify')
  })

  it('PROVIDERS.cryptopanic is enabled, named "CryptoPanic", category "news"', () => {
    expect(PROVIDERS.cryptopanic.enabled).toBe(true)
    expect(PROVIDERS.cryptopanic.name).toBe('CryptoPanic')
    expect(PROVIDERS.cryptopanic.category).toBe('news')
  })

  it('PROVIDERS.cryptocompare is enabled, named "CryptoCompare", category "news"', () => {
    expect(PROVIDERS.cryptocompare.enabled).toBe(true)
    expect(PROVIDERS.cryptocompare.name).toBe('CryptoCompare')
    expect(PROVIDERS.cryptocompare.category).toBe('news')
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

    it('returns the cryptocompare entry for "cryptocompare"', () => {
      const p = getProvider('cryptocompare')
      expect(p).toBeDefined()
      expect(p!.id).toBe('cryptocompare')
      expect(p!.name).toBe('CryptoCompare')
      expect(p!.category).toBe('news')
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

    it('returns true for "discord"', () => {
      expect(isEnabledProvider('discord')).toBe(true)
    })

    it('returns true for "cryptopanic"', () => {
      expect(isEnabledProvider('cryptopanic')).toBe(true)
    })

    it('returns true for "cryptocompare"', () => {
      expect(isEnabledProvider('cryptocompare')).toBe(true)
    })

    it('returns false for an empty string', () => {
      expect(isEnabledProvider('')).toBe(false)
    })
  })
})
