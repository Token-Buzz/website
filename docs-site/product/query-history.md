# Query History

Every query you submit on the [Analytics](./analytics.md) page is automatically saved as a snapshot. The History page lets you browse past queries, re-run them, view frozen snapshots of their results, and pin them to dashboards.

## Viewing your history

Navigate to **History** in the sidebar (or go to `/history`). Queries are listed chronologically, grouped by date:

- **Today**
- **Yesterday**
- **This week**
- **Older**

Each row shows the query string and the time it was submitted.

## Re-running a query

Click **Run** on any history row to re-submit that query on the Analytics page. This is equivalent to typing the query again — it ingests fresh data and uses one query from your monthly quota.

If you often re-run the same query, the Analytics search bar also shows a recent-queries dropdown when you focus it, giving you quick access to your last several searches without going to the History page.

## Viewing a snapshot

Click the query string itself (the link text in each row) to open the snapshot detail view (`/history/[queryId]`). A snapshot is a frozen copy of the analytics results from when the query was originally run — the same charts and data the Analytics page showed, preserved exactly as they were.

A banner at the top of the snapshot shows when the snapshot was taken and a **Refresh** button to re-run the query and create a new snapshot. Refreshing preserves the original snapshot; it creates a new one alongside it.

## Pinning a query to a dashboard

Click **Pin** on any history row to add that query's analytics cards to a dashboard.

1. A dashboard picker modal opens.
2. Select an existing dashboard, or create a new one by typing a name.
3. Click **Pin**.

All standard analytics cards are pinned as a batch. A confirmation banner appears with a **View dashboard →** link.

Pinning from a snapshot detail view works the same way.

## Snapshot retention

How long snapshots are kept depends on your plan:

| Plan | Snapshot retention |
|---|---|
| Free | 30 days |
| Pro | 1 year |
| Alpha | Forever |

Snapshots older than the retention window are deleted automatically. Upgrading your plan extends retention going forward.
