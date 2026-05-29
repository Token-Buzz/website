import { PROVIDERS } from '@monorepo-template/core/providers'
import type { ProviderId } from '@monorepo-template/core/providers'

export interface FieldMeta {
  name: string
  label: string
  placeholder: string
  secret: boolean
}

export interface ProviderMeta {
  id: ProviderId
  label: string
  fields: FieldMeta[]
  instructions: string[]
  docUrl: string
  docLabel: string
  docUrl2?: string
  docLabel2?: string
}

const META: Record<ProviderId, ProviderMeta> = {
  twitter: {
    id: 'twitter',
    label: 'X (twitterapi.io)',
    fields: [
      {
        name: 'apiKey',
        label: 'API key',
        placeholder: 'Enter your twitterapi.io API key',
        secret: true,
      },
    ],
    instructions: [
      'Sign up or log in at https://twitterapi.io',
      'Go to your dashboard and copy your API key',
      'Paste it below and click "Validate & save"',
      'Your key is stored encrypted and never shared',
    ],
    docUrl: 'https://twitterapi.io/docs',
    docLabel: 'twitterapi.io docs',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    fields: [
      {
        name: 'clientId',
        label: 'Client ID',
        placeholder: 'Your Reddit app client ID',
        secret: false,
      },
      {
        name: 'clientSecret',
        label: 'Client secret',
        placeholder: 'Your Reddit app client secret',
        secret: true,
      },
    ],
    instructions: [
      'Log in to Reddit and go to https://www.reddit.com/prefs/apps',
      'Click "create another app…" and choose type "script"',
      'Set the redirect URI to http://localhost:8080 (required but unused)',
      'Copy the Client ID (the string shown under the app name) and the secret',
      'Paste both values below',
    ],
    docUrl: 'https://github.com/reddit-archive/reddit/wiki/OAuth2',
    docLabel: 'Reddit OAuth2 docs',
    docUrl2: 'https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki',
    docLabel2: 'Reddit Data API Wiki',
  },
}

/**
 * Returns provider metadata for all currently-enabled BYOK providers,
 * in registry order. Automatically includes any new providers added to
 * PROVIDERS as long as a META entry exists for them.
 */
export function getEnabledProviderMeta(): ProviderMeta[] {
  return Object.values(PROVIDERS)
    .filter((p) => p.enabled)
    .map((p) => META[p.id])
    .filter((m): m is ProviderMeta => m !== undefined)
}
