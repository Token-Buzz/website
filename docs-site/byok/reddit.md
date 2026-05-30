# Connecting a Reddit Key

TokenBuzz uses the official Reddit API for post search. Because Reddit no longer issues shared project keys for commercial use, each user must supply their own Reddit "script" application credentials: a `client_id` and a `client_secret`.

## What you'll need

- A Reddit account.
- A Reddit "script" app registered under your account (takes about two minutes).
- The app's **Client ID** and **Client secret**.

## Get your credentials

1. Log in to Reddit and navigate to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps).
2. Scroll to the bottom and click **"create another app…"**.
3. Fill in any name (e.g. "TokenBuzz"). Under **type**, select **script**.
4. Set the **redirect URI** to `http://localhost:8080` — this value is required by Reddit but is never called by TokenBuzz.
5. Click **Create app**.
6. Reddit displays your new app. The **Client ID** is the short string shown directly under the app name (below the "personal use script" label). The **Client secret** is the longer string labeled "secret".
7. Copy both values.

## Connect in TokenBuzz

1. In TokenBuzz, open **Account → API Keys**.
2. Make sure the mode selector is set to **Per-source keys**.
3. Select the **Reddit** tab.
4. Paste your **Client ID** into the first field and your **Client secret** into the second field.
5. Click **Validate & save**. TokenBuzz uses your credentials to obtain an app-only OAuth token from Reddit and verifies it before storing. You'll see a confirmation card showing the last four characters of the stored credential and the validation date.
6. Optionally enable **Use my key for background polling** to have TokenBuzz automatically refresh your watchlist tokens in the background using your Reddit credentials (default polling interval is approximately 20 minutes).

To remove the credentials, click **Remove key** on the configured card.

## Security & notes

- Both the Client ID and Client secret are combined and encrypted with AWS KMS before being stored. Only the last four characters of the combined credential are shown in the UI.
- Credentials can be rotated by removing the existing entry and saving a new one.
- Reddit enforces a quota of 100 queries per minute on script apps. TokenBuzz respects `Retry-After` and `X-Ratelimit` headers and backs off automatically.
- If Reddit returns a 401 or 403, TokenBuzz marks the key as invalid and notifies you by email.
- Reddit's Data API terms of service apply to your usage. Review the [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) for details.
