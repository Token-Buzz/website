/**
 * Lightweight window-event bus for watchlist mutations.
 * Dispatched by WatchlistView after any local state change (add / delete / reorder)
 * so AppShell can re-fetch and keep the sidebar badge + entry list in sync.
 */
export const WATCHLIST_CHANGED_EVENT = 'watchlist:changed'
