# M8 — Query History

Every tweet-ingestion query submitted on the Analytics page becomes a saved, snapshotted object. Users can view past snapshots, refresh queries, and pin saved queries to M2 dashboards. The missing link between exploratory Analytics use and persistent dashboards.

## ClickUp tasks consolidated here

- Query History

The original ClickUp description: "Users should be able to go back in time and retrieve snapshots of their query history as well as refresh the queries, functionality should carry over from the Analytics submenu into their personalized dashboard."

## Locked decisions

- **Snapshot captures query + aggregate data** (not individual tweet IDs in v1) — enables "compare ai agents now vs 2 weeks ago" without storing the underlying tweet list.
- **Sidebar entry `History` + inline recent-queries drawer on the Analytics SearchBar.** Sidebar = home, inline = quick re-running.
- **Explicit "Pin to dashboard" button** bridges to M2 — auto-creating dashboards from every query would create clutter.
- **Retention is plan-gated** (M5): Free 30 days / Pro 1 year / Alpha forever.

## Schema additions

```ts
// UserData table
savedQueryKey(userId, submittedAt, queryHash) => {
  pk: `USER#${userId}`,
  sk: `QUERY#${submittedAt}#${queryHash}`,
}
// attrs: { query, submittedAt, aggregateSnapshot, ttl? }
```

Snapshot blob is ~5–20 KB per row (the same data shape the Analytics page renders).

## Phases

### Phase 1 — SavedQuery write hook

- When the Analytics SearchBar submits a query and ingestion completes, write a SavedQuery row with the query string, timestamp, and a JSON blob of the aggregate data the cards rendered (top mentions, sentiment ratio, domain distribution, lang split, source split, etc.).
- TTL set from the user's current plan retention.

### Phase 2 — History page + sidebar entry

- New route `/history`.
- Sidebar nav: add "History" between Analytics and Watchlist.
- Page renders saved queries chronologically, grouped by date (Today / Yesterday / This week / Older).
- Each row: query string · timestamp · `Refresh` button · `Pin to dashboard` button.

### Phase 3 — Snapshot detail view

- Click a saved query → `/history/[queryId]`.
- Renders the same Analytics card layout but from the snapshot data, not live.
- Top banner: "Snapshot from May 10 · Refresh →".
- Refresh re-runs the query, consumes 1 from the monthly tweet-query quota (M5), creates a new snapshot, routes to it. Original snapshot preserved.

### Phase 4 — Inline recent-queries drawer

- On the Analytics SearchBar, dropdown showing the last 10 queries when the input is focused.
- Click to re-submit.
- Bridges casual exploration to the History page without forcing users to hunt.

### Phase 5 — Pin to dashboard

- "Pin to dashboard" button on any saved query → modal with dashboard picker (existing M2 dashboards + "Create new").
- On select: all analytics cards from the query are added to the chosen dashboard with the query string baked into each card's config.
- Confirmation toast with link.

### Phase 6 — Retention enforcement

- Daily EventBridge Lambda sweeps `SavedQuery` rows older than the owning user's tier retention window.
- Free 30 days / Pro 365 days / Alpha no-expiry.
- TTL set at write time based on plan; upgrades extend it on next write, downgrades don't retroactively delete.

## Dependencies

- Requires M1 (the Analytics ingestion pipeline) and M2 (the dashboard target for "Pin to dashboard").
- Couples with M5 for tier retention.
