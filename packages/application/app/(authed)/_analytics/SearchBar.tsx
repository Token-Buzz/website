"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Icon } from "../_dashboard/primitives";
import { useUpgradeModal } from "@/app/_billing/UpgradeModalProvider";
import type { Plan } from "@monorepo-template/core/billing/tiers";
import type { SavedQueryListItem } from "@monorepo-template/core/db/saved-queries";
import { recentDistinctQueries } from "@monorepo-template/core/lib/recent-queries";

interface SearchBarProps {
  onIngested?: (query: string) => void;
}

// ── Timestamp formatter ────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SearchBar({ onIngested }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Seed local state from the URL on first render.
  // We don't sync via useEffect (triggers cascading renders) — the
  // user's submitted value is what drives the URL; browser-back
  // reloads the page/component which reseeds this state.
  const { openUpgrade } = useUpgradeModal();
  const [value, setValue] = useState(() => searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState<null | "missing" | "invalid">(null);
  const [quota, setQuota] = useState<{ used: number; limit: number | null; plan: string } | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Recent queries dropdown state
  const [recent, setRecent] = useState<SavedQueryListItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/query/quota")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setQuota({ used: data.used, limit: data.limit, plan: data.plan }); })
      .catch(() => { /* best-effort */ });
  }, []);

  // Fetch recent queries on mount (best-effort)
  useEffect(() => {
    fetch("/api/history/list")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { queries?: SavedQueryListItem[] } | null) => {
        if (data?.queries) {
          setRecent(recentDistinctQueries(data.queries, 10));
        }
      })
      .catch(() => { /* best-effort */ });
  }, []);

  // Close dropdown on outside mousedown
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  async function runQuery(trimmed: string) {
    setError(null);
    setNeedsKey(null);
    setQuotaExceeded(false);
    setLoading(true);

    // Update URL first so the query persists even if the POST fails.
    // Using replace() so hitting back doesn't cycle through every keystroke.
    router.replace(`?q=${encodeURIComponent(trimmed)}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55_000);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed, maxPages: 5 }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 402) {
          const body = await res.json().catch(() => ({}));
          const b = body as { used?: number; limit?: number | null; plan?: string };
          setQuota({ used: b.used ?? 0, limit: b.limit ?? 0, plan: b.plan ?? "free" });
          setQuotaExceeded(true);
          return;
        }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          if ((body as { error?: string }).error === "byok_required") {
            setNeedsKey((body as { reason?: string }).reason === "invalid" ? "invalid" : "missing");
            return;
          }
        }
        if (res.status === 429) {
          throw new Error("Server is busy — please try again in a moment.");
        }
        if (res.status === 504) {
          throw new Error("Search timed out — try again or pick a less broad query.");
        }
        if (res.status === 502) {
          const body = await res.json().catch(() => ({}));
          const reason =
            (body as { detail?: string; error?: string }).detail ??
            (body as { detail?: string; error?: string }).error ??
            "(no detail)";
          throw new Error(`Search failed: ${reason}`);
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ??
            `Request failed (${res.status})`,
        );
      }

      onIngested?.(trimmed);
      setQuota((q) => (q ? { ...q, used: q.used + 1 } : q));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Search timed out — try again or pick a less broad query.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    runQuery(trimmed);
  }

  const dropdownId = "search-recent-queries-listbox";

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* Input wrapper — position:relative so dropdown can be absolutely placed */}
        <div ref={wrapperRef} style={{ flex: 1, position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 12px",
              height: 40,
              background: "var(--bg-elevated)",
              border: `1px solid ${error ? "var(--bear-500, #e05252)" : "var(--border)"}`,
              borderRadius: 8,
              transition: "border-color 120ms",
            }}
          >
            <Icon name="search" size={16} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
            <input
              type="text"
              role="combobox"
              aria-expanded={open}
              aria-controls={dropdownId}
              aria-autocomplete="list"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => { if (recent.length > 0) setOpen(true); }}
              onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
              placeholder="Search a query, e.g. $BTC or #solana…"
              disabled={loading}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                font: "500 14px var(--font-sans)",
                color: "var(--fg-1)",
                caretColor: "var(--buzz-500)",
              }}
            />
            {loading && (
              <span
                style={{
                  font: "500 11px var(--font-mono)",
                  color: "var(--fg-3)",
                  flexShrink: 0,
                }}
              >
                Loading&hellip;
              </span>
            )}
          </div>

          {/* Recent queries dropdown */}
          {open && recent.length > 0 && (
            <div
              id={dropdownId}
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 50,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "8px 12px 4px",
                  font: "600 11px/1.2 var(--font-sans)",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "var(--fg-3)",
                }}
              >
                Recent queries
              </div>

              {recent.map((item) => (
                <button
                  key={`${item.submittedAt}::${item.queryHash}`}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    setOpen(false);
                    setValue(item.query);
                    runQuery(item.query);
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-sunken)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    title={item.query}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--fg-1)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.query}
                  </span>
                  <span
                    style={{
                      font: "500 11px/1 var(--font-mono)",
                      color: "var(--fg-3)",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {formatTimestamp(item.submittedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          icon="send"
          disabled={loading || value.trim() === ""}
        >
          {loading ? "Searching…" : "Search"}
        </Button>
      </form>

      {needsKey && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--accent, #6c63ff)",
            borderRadius: 6,
            font: "500 12px var(--font-sans)",
            color: "var(--fg-1)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ flex: 1 }}>
            {needsKey === "invalid"
              ? "Your twitterapi.io API key was rejected — re-enter it to keep querying."
              : "Add your twitterapi.io API key to run queries on your own quota."}
          </span>
          <Link
            href="/account/api-keys"
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              background: "var(--accent, #6c63ff)",
              color: "#fff",
              borderRadius: 6,
              font: "600 12px var(--font-sans)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {needsKey === "invalid" ? "Update API key" : "Add API key"}
          </Link>
        </div>
      )}

      {quotaExceeded && quota && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 14px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--accent, #6c63ff)",
            borderRadius: 6,
            font: "500 12px var(--font-sans)",
            color: "var(--fg-1)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ flex: 1 }}>
            You&apos;ve used {quota.used} / {quota.limit} queries this month. Upgrade for a higher limit.
          </span>
          <button
            onClick={() => openUpgrade({ currentPlan: quota.plan as Plan })}
            style={{
              flexShrink: 0,
              padding: "5px 12px",
              background: "var(--accent, #6c63ff)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              font: "600 12px var(--font-sans)",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Upgrade plan
          </button>
        </div>
      )}

      {quota && quota.limit !== null && !quotaExceeded && (
        <div
          style={{
            marginTop: 6,
            font: "500 10px var(--font-mono)",
            color: "var(--fg-3)",
          }}
        >
          {quota.used} / {quota.limit} queries used this month
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "var(--bear-100, rgba(224,82,82,0.1))",
            border: "1px solid var(--bear-500, #e05252)",
            borderRadius: 6,
            font: "500 12px var(--font-sans)",
            color: "var(--bear-500, #e05252)",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
