"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "../_dashboard/primitives";

interface MonitorToggleProps {
  query: string;
}

interface Monitor {
  userId: string;
  query: string;
  sources: string[];
  intervalMs: number;
  createdAt: string;
  updatedAt: string;
}

type FetchState = "idle" | "loading" | "error";

export function MonitorToggle({ query }: MonitorToggleProps) {
  const [active, setActive] = useState(false);
  const [fetchState, setFetchState] = useState<FetchState>("idle");
  const [toggling, setToggling] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);

  const trimmed = query.trim();

  const checkMonitor = useCallback(async () => {
    if (!trimmed) return;
    setFetchState("loading");
    try {
      const res = await fetch("/api/monitors");
      if (!res.ok) {
        setFetchState("error");
        return;
      }
      const json = (await res.json()) as { monitors: Monitor[] };
      const found = json.monitors.some((m) => m.query.trim() === trimmed);
      setActive(found);
      setFetchState("idle");
    } catch {
      setFetchState("error");
    }
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(false);
    setInlineMessage(null);
    void checkMonitor();
  }, [trimmed, checkMonitor]);

  if (!trimmed) return null;

  async function handleToggle() {
    setToggling(true);
    setInlineMessage(null);
    try {
      if (active) {
        const res = await fetch(
          `/api/monitors?query=${encodeURIComponent(trimmed)}`,
          { method: "DELETE" },
        );
        if (res.status === 401) {
          setInlineMessage("Sign in to manage monitors.");
          return;
        }
        if (!res.ok) {
          setInlineMessage("Failed to remove monitor — please try again.");
          return;
        }
        setActive(false);
      } else {
        const res = await fetch("/api/monitors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, sources: ["twitter"] }),
        });
        if (res.status === 401) {
          setInlineMessage("Sign in to set up monitors.");
          return;
        }
        if (res.status === 403) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          if (body.error === "source_locked") {
            setInlineMessage("Upgrade your plan to monitor additional sources.");
          } else {
            setInlineMessage("You don't have access to this feature.");
          }
          return;
        }
        if (!res.ok) {
          setInlineMessage("Failed to create monitor — please try again.");
          return;
        }
        setActive(true);
      }
    } catch {
      setInlineMessage("Something went wrong — please try again.");
    } finally {
      setToggling(false);
    }
  }

  const isLoading = fetchState === "loading" || toggling;

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--buzz-500)" : "var(--border)"}`,
    font: "500 12px var(--font-sans)",
    color: active ? "var(--buzz-500)" : "var(--fg-3)",
    background: active
      ? "rgba(var(--buzz-500-rgb, 99,102,241), 0.08)"
      : "transparent",
    cursor: isLoading ? "default" : "pointer",
    opacity: isLoading ? 0.6 : 1,
    transition: "border-color 120ms, color 120ms, background 120ms, opacity 120ms",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isLoading}
        style={buttonStyle}
        title={active ? "Stop monitoring this query" : "Monitor this query automatically"}
      >
        <Icon name="bell" size={13} style={{ flexShrink: 0 }} />
        <span>
          {isLoading
            ? active
              ? "Monitoring…"
              : "Activating…"
            : active
            ? "Monitoring · on"
            : "Monitor this query"}
        </span>
      </button>

      {inlineMessage && (
        <span
          style={{
            font: "500 11px var(--font-sans)",
            color: "var(--bear-500, #e05252)",
            maxWidth: 220,
            textAlign: "right",
          }}
        >
          {inlineMessage}
        </span>
      )}
    </div>
  );
}
