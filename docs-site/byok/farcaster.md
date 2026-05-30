# Farcaster

TokenBuzz searches Farcaster casts via the [Neynar API](https://neynar.com/). Unlike the other social providers, **Farcaster does not require you to supply a key** — TokenBuzz holds a project-level Neynar API key that is shared across all users. Farcaster search is available to every account on the Free tier with no setup on your part.

## What you'll need

Nothing. No account registration, no API key, no configuration in the Account UI.

## How Farcaster works in TokenBuzz

- When you run a search that includes the **Farcaster** source, TokenBuzz queries the Neynar API using its own project key.
- Background polling for Farcaster is also handled by the project key — it runs at roughly a 2-minute cadence alongside X/Twitter polling.
- Results land in the same shared analytics tables as every other source, so Farcaster casts appear in your dashboards and watchlist alongside X, Reddit, and Telegram content.

## Background polling

Because Farcaster uses a project-managed key, the background polling toggle in the API Keys tab does not apply to Farcaster. Farcaster monitoring runs automatically for all users who add Farcaster as a source to their watchlist.

## Notes

- Farcaster search quality depends on Neynar's free-tier limits. If you encounter rate-limit errors, this reflects the project's Neynar plan capacity.
- No user credential is stored or encrypted on your behalf for Farcaster.
- You do not need to do anything in the Account → API Keys UI to enable Farcaster.
