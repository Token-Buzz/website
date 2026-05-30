# Connecting an X (Twitter) Key

TokenBuzz fetches X/Twitter posts through [twitterapi.io](https://twitterapi.io), a third-party API proxy. You sign up with twitterapi.io directly, get an API key, and paste it into TokenBuzz.

## What you'll need

- A twitterapi.io account with an active plan.
- Your twitterapi.io API key (a single string shown in the twitterapi.io dashboard).

## Get your credentials

1. Go to [https://twitterapi.io](https://twitterapi.io) and sign up or log in.
2. Open your dashboard. Your API key is displayed on the main page or under an "API Key" section.
3. Copy the key — it is a long alphanumeric string.

## Connect in TokenBuzz

1. In TokenBuzz, open **Account → API Keys**.
2. Make sure the mode selector is set to **Per-source keys**.
3. Select the **X (twitterapi.io)** tab.
4. Paste your API key into the **API key** field.
5. Click **Validate & save**. TokenBuzz calls twitterapi.io to verify the key before storing it. You'll see a confirmation card showing the last four characters of the key and the validation date.
6. Optionally enable **Use my key for background polling** to have TokenBuzz automatically refresh your watchlist tokens in the background.

To remove the key, click **Remove key** on the configured card.

## Security & notes

- Your key is encrypted with AWS KMS before being stored. Only the last four characters are ever shown in the UI.
- Keys can be rotated by removing the existing key and saving a new one.
- If twitterapi.io returns a 401 or 403, TokenBuzz marks the key as invalid and sends you an email with a link to re-enter it.
- Queries run against your twitterapi.io quota. TokenBuzz does not meter or cap your usage beyond what your twitterapi.io plan allows.
