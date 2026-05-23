# M1 — Movers / Live feed / Alerts

The foundation milestone. Establishes the ingestion → aggregate read path that all other feature milestones depend on. Without M1's data layer, M2, M6, M8, and M9 have nothing to render.

## ClickUp tasks consolidated here

- Brainstorm Movers, Live feed, and Alerts
- Review Movers and Live feed

## Phases

### Phase 1 — Data layer foundation

- New key builders in `packages/core/src/db/keys.ts` for movers (Top-K ranked tokens by buzz delta), live feed (recent tweets stream), and alerts (user-owned alert rules + per-rule trigger history).
- DynamoDB Streams handler in the jobs Lambda family writes `Aggregates` rows for hour-over-hour mention deltas (the source of "movers").
- New API routes in the application:
  - `GET /api/movers?window=1h|24h|7d` — top-N tokens by buzz delta in the window
  - `GET /api/live-feed?cursor=...` — paginated stream of recent tweets matching the user's watchlist
  - `GET /api/alerts` / `POST /api/alerts` / `DELETE /api/alerts/:id` — alert CRUD

### Phase 2 — Movers UI

- New `/movers` route in the authed app.
- Server-rendered table of top movers with sort toggles (buzz delta, mentions count, sentiment swing).
- Time-window pills (`1h / 24h / 7d`) drive the underlying query.

### Phase 3 — Live feed UI

- New `/live-feed` route.
- Infinite-scroll list of recent tweets filtered by user's watchlist + global sentiment signals.
- Tweet card shows author, text, engagement, token tags, time, sentiment chip.

### Phase 4 — Alerts UI + rule plumbing

- New `/alerts` route.
- Alert rule form: pick a token, pick a trigger condition (mention spike, sentiment swing, KOL post, price move), pick a delivery channel (in-app only for v1; email / SMS / Slack / webhook gated to higher tiers in M5).
- Rule evaluation lives in a streaming Lambda — every aggregate write checks active rules against the new value; matches enqueue a delivery job.
- In-app inbox renders triggered alerts with deep-links into Movers / Live feed.

## Dependencies

- Unblocks M2, M3, M6, M8, M9.
- Requires no prior milestone (the foundation).

## Notes

- "Alerts" gets two follow-ons in later milestones: the alert-channel options expand with M5 (paid tiers unlock email/SMS/Slack/webhook), and the alert-authoring UX gets a "New alert via Hum" entry-point from M4's quick-add menu (which routes to M3 Hum with a preset prompt).
