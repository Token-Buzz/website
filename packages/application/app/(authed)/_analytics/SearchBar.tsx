"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Icon } from "../_dashboard/primitives";

interface SearchBarProps {
  onIngested?: (query: string) => void;
}

export function SearchBar({ onIngested }: SearchBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Seed local state from the URL on first render.
  // We don't sync via useEffect (triggers cascading renders) — the
  // user's submitted value is what drives the URL; browser-back
  // reloads the page/component which reseeds this state.
  const [value, setValue] = useState(() => searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    setError(null);
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
        {/* Input wrapper */}
        <div
          style={{
            flex: 1,
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
            value={value}
            onChange={(e) => setValue(e.target.value)}
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
