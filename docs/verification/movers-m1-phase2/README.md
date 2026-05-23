# Movers UI (M1 Phase 2) — verification screenshots

Captured 2026-05-23 in a real browser, signed in via the Clerk dev instance, against a local dynalite seeded with 8 sample tokens. Confirms the per-window buzz-delta GSI queries (`SpikingByDelta` / `SpikingByDelta24h` / `SpikingByDelta7d`) return distinct, correctly-ordered sets per window. Verdict: **PASS**.

- `movers-1h.png` — 1H window: `$PEPE +9999%` tops the list; `$SHIB` absent (1H delta = 0, excluded from the GSI).
- `movers-24h.png` — 24H window: reorders to `$MOG` / `$WIF +890%` / `$DOGE` …; `$FLOKI` absent.
- `movers-7d.png` — 7D window: `$MOG` / `$BONK +560%` / `$DOGE` …; `$FLOKI` absent.
- `movers-sort-mentions.png` — sorted by Mentions desc (`$PEPE` 18.4k → `$WEN` 1.9k).
- `movers-mobile.png` — 390×844 viewport. Note: the authed sidebar does not collapse on mobile (shell-wide, not Movers-specific).
