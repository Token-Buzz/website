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
  telegram: {
    id: 'telegram',
    label: 'Telegram',
    fields: [
      { name: 'apiId', label: 'API ID', placeholder: 'Your Telegram api_id (a number)', secret: false },
      { name: 'apiHash', label: 'API hash', placeholder: 'Your Telegram api_hash', secret: true },
      { name: 'session', label: 'Session string', placeholder: 'Your GramJS StringSession', secret: true },
    ],
    instructions: [
      'Log in at https://my.telegram.org with your phone number',
      'Open "API development tools" and create an application (any title and short name)',
      'Copy the api_id (a number) and the api_hash it shows you',
      'Generate a login session string (a GramJS StringSession) by signing in once with those credentials — see the docs link below',
      'Paste the API ID, API hash, and session string into the fields above',
      'Your credentials are stored encrypted and never shared',
    ],
    docUrl: 'https://core.telegram.org/api/obtaining_api_id',
    docLabel: 'Obtaining api_id (Telegram docs)',
    docUrl2: 'https://gram.js.org/',
    docLabel2: 'GramJS (session strings)',
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    fields: [
      { name: 'token', label: 'Bot token', placeholder: 'Your Discord bot token', secret: true },
    ],
    instructions: [
      'Go to https://discord.com/developers/applications and create a New Application',
      'Open the "Bot" tab, add a bot, and click "Reset Token" to reveal it',
      'Enable the "Message Content Intent" toggle on the Bot tab (required to read message text)',
      'Invite the bot to the servers you want to monitor (OAuth2 → URL Generator → scope "bot", permissions: View Channels + Read Message History)',
      'Paste the bot token below and click "Validate & save"',
      'Your token is stored encrypted and never shared',
    ],
    docUrl: 'https://discord.com/developers/docs/intro',
    docLabel: 'Discord Developer Portal',
    docUrl2: 'https://discord.com/developers/docs/topics/oauth2#bot-authorization-flow',
    docLabel2: 'Discord bot setup',
  },
  apify: {
    id: 'apify',
    label: 'Apify',
    fields: [
      { name: 'apiToken', label: 'API token', placeholder: 'Your Apify API token', secret: true },
    ],
    instructions: [
      'Sign up or log in at https://apify.com',
      'Go to Settings → Integrations and copy your personal API token',
      'Paste it below and click "Validate & save"',
      'Your token is stored encrypted and never shared',
    ],
    docUrl: 'https://docs.apify.com/platform/integrations/api',
    docLabel: 'Apify API docs',
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
