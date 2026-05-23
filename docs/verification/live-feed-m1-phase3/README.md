# Live Feed UI (M1 Phase 3) — verification screenshots

Captured 2026-05-23 in a real browser, signed in via the Clerk dev instance, against a local dynalite seeded with a watchlist (`PEPE`/`WIF`/`BONK`) + 45 tweets across those queries (sentiment split bull/bear/neu, 15 each). Confirms `GET /api/live-feed` end to end: watchlist fan-out, cursor pagination, and the sentiment filter. **Verdict: PASS.**

- `live-feed-default.png` — initial load: 30 tweets (page 1), `All` filter.
- `live-feed-scrolled.png` — after infinite scroll: 45 tweets loaded with the "End of feed" footer (page 2 fetched via the opaque cursor).
- `live-feed-bull.png` — `Bull` sentiment filter resets the feed and returns only the 15 bull tweets.
- `live-feed-mobile.png` — 390×844. (The authed shell sidebar doesn't collapse on mobile — shell-wide, not feature-specific.)

Auth gate confirmed: unauthenticated `GET /api/live-feed` → `401`.
