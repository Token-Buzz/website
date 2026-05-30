# BYOK (Bring Your Own Key) Overview

TokenBuzz lets you connect your own API credentials for each social data provider — your key, your quota, your cost.

## What is BYOK and why does TokenBuzz use it?

Social data APIs charge per request. Rather than maintaining a shared project key that all users draw from, TokenBuzz routes each user's queries through their own provider credentials. This means:

- **No shared quota.** Your searches and background polling don't compete with other users.
- **Direct billing.** You pay the provider directly (twitterapi.io, Apify, Reddit, etc.) at whatever plan you've chosen.
- **No project metering.** TokenBuzz doesn't count or cap your API calls — your provider plan is the only limit.

Results from your key-driven queries still land in TokenBuzz's shared analytics tables, so everyone benefits from the data your monitoring produces.

## Security

All credentials are encrypted with a **customer-managed AWS KMS key** before being stored. TokenBuzz never stores credentials in plaintext, never logs them, and never returns them in full — only the last four characters are shown in the UI for identification. You can rotate or remove any key at any time from Account → API Keys.

## How to reach the API Keys UI

1. Sign in to your TokenBuzz account.
2. Click your avatar or account name in the top navigation.
3. Select **Account** from the dropdown.
4. Open the **API Keys** tab.

## Supported providers

| Provider | Credential required | What it unlocks |
|---|---|---|
| **X (twitterapi.io)** | twitterapi.io API key (single string) | X/Twitter post search and background polling |
| **Reddit** | Reddit app `client_id` + `client_secret` | Reddit post search via the official API |
| **Telegram** | `apiId`, `apiHash`, and GramJS `StringSession` (JSON) | Telegram channel message search |
| **Discord** | Discord bot token (single string) | Discord server message search |
| **Apify** | Apify personal API token | All sources via Apify Actors (all-in-one mode) |
| **Farcaster** | None — provided by TokenBuzz | Farcaster cast search (no key required) |

## Ingestion modes

The API Keys tab has a segmented control at the top: **Per-source keys** or **Apify**.

### Per-source keys (default)

Each social source uses its own dedicated key:
- X uses your twitterapi.io key.
- Reddit uses your Reddit app credentials.
- Telegram uses your MTProto credentials.
- Discord uses your Discord bot token.
- Farcaster uses TokenBuzz's project Neynar key (no setup required).

You only need to connect the providers you want to query.

### Apify (all-in-one mode)

Instead of one key per provider, you supply a single **Apify API token** and TokenBuzz routes every source through Apify's pre-built scraper Actors. This covers X, Reddit, Farcaster, Telegram, and Discord — all from one token.

Switching the segmented control to **Apify** sets Apify as your global default ingestion method. You can also pin individual sources to a different mode using the **Per-source overrides** section that appears below the Apify panel. Each source shows a three-way toggle: **Default** (follows the global setting), **Per-source** (use the direct provider key for just this source), or **Apify**.

See [Apify](./apify.md) for full setup instructions.

## Background polling

Once a key is connected and validated, you can opt into **background polling** using the toggle on the key's card. When enabled, TokenBuzz uses your key to refresh your watchlist tokens in the background — even when you're not actively using the app. The toggle is per-provider and off by default.
