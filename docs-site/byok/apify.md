# Connecting an Apify Key (All-in-One Mode)

Apify is an optional alternative to per-source keys. Instead of connecting a separate credential for X, Reddit, Telegram, Discord, and Farcaster individually, you supply a single **Apify API token** and TokenBuzz routes every source through Apify's pre-built scraper Actors — all billed to your own Apify account.

## What you'll need

- An [Apify](https://apify.com) account with a paid plan (Actors consume compute units billed to your account).
- Your Apify personal API token.

## Get your credentials

1. Go to [https://apify.com](https://apify.com) and sign up or log in.
2. Click your avatar in the top right and open **Settings**.
3. Navigate to **Integrations** (or **API & Integrations**).
4. Copy your **Personal API token** — it begins with `apify_api_`.

Reference: [Apify API authentication docs](https://docs.apify.com/platform/integrations/api)

## Connect in TokenBuzz

1. In TokenBuzz, open **Account → API Keys**.
2. Use the mode selector at the top of the section to switch to **Apify**.
3. Paste your Apify personal API token into the **API token** field.
4. Click **Validate & save**. TokenBuzz calls the Apify API to verify the token before storing it. You'll see a confirmation card showing the last four characters and the validation date.

### Set Apify as the global default

Switching the mode selector to **Apify** also sets Apify as your global ingestion default — all sources (X, Reddit, Farcaster, Telegram, Discord) will run through Apify Actors instead of their direct provider keys.

### Per-source overrides

Below the Apify token panel you'll find a **Per-source overrides** section listing every source. Each has a three-way toggle:

- **Default** — inherits the global setting (Apify if you've selected the Apify mode).
- **Per-source** — uses the direct provider key for this source only (you must have that key connected on the Per-source keys tab).
- **Apify** — forces this source through Apify regardless of the global default.

This lets you mix and match: for example, keep your direct twitterapi.io key for X (faster, synchronous) while running Reddit and Farcaster through Apify.

To remove the Apify token, switch back to **Per-source keys** mode and click **Remove key** on the Apify token card, or navigate to the Apify panel and remove it there.

## Sources covered by Apify mode

Apify mode covers the same sources as direct per-source mode: **X, Reddit, Farcaster, Telegram, and Discord**. Each source maps to a well-known public Apify Actor (e.g. `apidojo~tweet-scraper` for X, `trudax~reddit-scraper` for Reddit); TokenBuzz normalises Actor output into the same format as direct ingestion.

## Security & notes

- Your Apify token is encrypted with AWS KMS before being stored. Only the last four characters are shown in the UI.
- The token can be rotated by removing it and saving a new one.
- Apify Actor runs are billed **directly to your Apify account** (per compute unit / per result). TokenBuzz does not meter or cap your Apify usage. Review [Apify pricing](https://apify.com/pricing) before enabling.
- If Apify returns a 401 or 403 for your token, TokenBuzz marks the token invalid and notifies you by email with a link to re-enter it.
- For manual (on-demand) searches, TokenBuzz uses Apify's synchronous `run-sync-get-dataset-items` endpoint with a timeout cap. If a run exceeds the cap, a partial or empty result is returned rather than blocking your request.
