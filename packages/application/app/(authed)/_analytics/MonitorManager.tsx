"use client";

import { useState, useEffect, useCallback } from "react";
import { Icon } from "../_dashboard/primitives";
import type { SocialSource } from "@monorepo-template/core/sources/types";
import type { Plan } from "@monorepo-template/core/billing/tiers";
import { planMeets } from "@monorepo-template/core/billing/tiers";
import { SOURCE_META } from "./sources";

// ── Types ──────────────────────────────────────────────────────────────────

interface Monitor {
  userId: string;
  query: string;
  sources: SocialSource[];
  intervalMs: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Interval options ───────────────────────────────────────────────────────

const INTERVAL_OPTIONS: { label: string; value: number }[] = [
  { label: "Every 2 minutes", value: 120_000 },
  { label: "Every 5 minutes", value: 300_000 },
  { label: "Every 15 minutes", value: 900_000 },
  { label: "Every 30 minutes", value: 1_800_000 },
  { label: "Every hour", value: 3_600_000 },
];

function intervalLabel(ms: number): string {
  const opt = INTERVAL_OPTIONS.find((o) => o.value === ms);
  if (opt) return opt.label;
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `Every ${mins} min`;
  return `Every ${Math.round(mins / 60)}h`;
}

// ── Editor sub-component ───────────────────────────────────────────────────

interface EditorProps {
  query: string;
  existing: Monitor | null;
  plan: Plan;
  onSave: (sources: SocialSource[], intervalMs: number) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  inlineMessage: string | null;
}

function MonitorEditor({
  query,
  existing,
  plan,
  onSave,
  onCancel,
  saving,
  inlineMessage,
}: EditorProps) {
  const defaultSources: SocialSource[] =
    existing?.sources.length
      ? existing.sources
      : (["twitter", "farcaster"] as SocialSource[]);

  const [checkedSources, setCheckedSources] = useState<SocialSource[]>(defaultSources);
  const [intervalMs, setIntervalMs] = useState<number>(
    existing?.intervalMs ?? 120_000,
  );

  function toggleSource(id: SocialSource, selectable: boolean) {
    if (!selectable) return;
    setCheckedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  const panelStyle: React.CSSProperties = {
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 240,
    maxWidth: 320,
  };

  const labelStyle: React.CSSProperties = {
    font: "600 11px var(--font-mono)",
    color: "var(--fg-4)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: 4,
  };

  return (
    <div style={panelStyle}>
      {/* Query display */}
      <div>
        <div style={labelStyle}>Query</div>
        <div
          style={{
            font: "500 12px var(--font-mono)",
            color: "var(--fg-2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {query}
        </div>
      </div>

      {/* Sources */}
      <div>
        <div style={labelStyle}>Sources</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {SOURCE_META.map((meta) => {
            const selectable =
              meta.implemented && planMeets(plan, meta.minPlan);
            const checked = checkedSources.includes(meta.id);
            const tierLabel =
              !meta.implemented
                ? "Coming soon"
                : !selectable
                ? `Requires ${meta.minPlan === "pro" ? "Pro" : "Alpha"}`
                : null;

            return (
              <label
                key={meta.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: selectable ? "pointer" : "default",
                  opacity: selectable ? 1 : 0.5,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectable ? checked : false}
                  disabled={!selectable}
                  onChange={() => toggleSource(meta.id, selectable)}
                  style={{ cursor: selectable ? "pointer" : "not-allowed" }}
                />
                <span
                  style={{
                    font: "500 12px var(--font-sans)",
                    color: "var(--fg-2)",
                  }}
                >
                  {meta.displayName}
                </span>
                {tierLabel && (
                  <span
                    style={{
                      font: "500 10px var(--font-sans)",
                      color: "var(--fg-4)",
                      marginLeft: 2,
                    }}
                  >
                    {tierLabel}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Interval */}
      <div>
        <div style={labelStyle}>Interval</div>
        <select
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "5px 8px",
            borderRadius: 5,
            border: "1px solid var(--border)",
            background: "var(--bg-elevated)",
            color: "var(--fg-1)",
            font: "500 12px var(--font-sans)",
            cursor: "pointer",
          }}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div
          style={{
            font: "500 10px var(--font-sans)",
            color: "var(--fg-4)",
            marginTop: 4,
          }}
        >
          Some sources poll slower regardless (Reddit ~20m, Telegram/Discord ~15m).
        </div>
      </div>

      {/* Error message */}
      {inlineMessage && (
        <span
          style={{
            font: "500 11px var(--font-sans)",
            color: "var(--bear-500, #e05252)",
          }}
        >
          {inlineMessage}
        </span>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--fg-3)",
            font: "500 12px var(--font-sans)",
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSave(checkedSources, intervalMs)}
          disabled={saving || checkedSources.length === 0}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            border: "1px solid var(--buzz-500)",
            background: "rgba(var(--buzz-500-rgb, 99,102,241), 0.12)",
            color: "var(--buzz-500)",
            font: "600 12px var(--font-sans)",
            cursor:
              saving || checkedSources.length === 0 ? "default" : "pointer",
            opacity: saving || checkedSources.length === 0 ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface MonitorManagerProps {
  query: string;
}

export function MonitorManager({ query }: MonitorManagerProps) {
  const trimmed = query.trim();

  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [plan, setPlan] = useState<Plan>("free");
  const [loading, setLoading] = useState(false);

  // editor state: null = closed, "new" = new monitor, Monitor = editing a specific one
  const [editing, setEditing] = useState<Monitor | null | "new">(null);
  const [editingQuery, setEditingQuery] = useState<string>(trimmed);

  // manage-list expanded
  const [listOpen, setListOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<string | null>(null);
  const [togglingQuery, setTogglingQuery] = useState<string | null>(null);
  const [deletingQuery, setDeletingQuery] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!trimmed) return;
    setLoading(true);
    try {
      const [mRes, pRes] = await Promise.all([
        fetch("/api/monitors"),
        fetch("/api/billing/plan"),
      ]);
      if (mRes.ok) {
        const j = (await mRes.json()) as { monitors: Monitor[] };
        setMonitors(j.monitors.map((m) => ({ ...m, enabled: m.enabled ?? true })));
      }
      if (pRes.ok) {
        const j = (await pRes.json()) as { plan: Plan };
        setPlan(j.plan ?? "free");
      }
    } finally {
      setLoading(false);
    }
  }, [trimmed]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
    setEditing(null);
    setInlineMessage(null);
  }, [fetchData]);

  if (!trimmed) return null;

  const currentMonitor = monitors.find((m) => m.query.trim() === trimmed) ?? null;

  // ── Save (create or update) ──────────────────────────────────────────────

  async function handleSave(sources: SocialSource[], intervalMs: number) {
    setSaving(true);
    setInlineMessage(null);
    try {
      const targetQuery =
        editing !== "new" && editing !== null ? editing.query : editingQuery;
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: targetQuery,
          sources,
          intervalMs,
          enabled: true,
        }),
      });
      if (res.status === 401) {
        setInlineMessage("Sign in to manage monitors.");
        return;
      }
      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "source_locked") {
          setInlineMessage("Upgrade your plan to monitor additional sources.");
        } else {
          setInlineMessage("You don't have access to this feature.");
        }
        return;
      }
      if (!res.ok) {
        setInlineMessage("Failed to save monitor — please try again.");
        return;
      }
      setEditing(null);
      await fetchData();
    } catch {
      setInlineMessage("Something went wrong — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Pause / Resume ───────────────────────────────────────────────────────

  async function handleToggleEnabled(monitor: Monitor) {
    setTogglingQuery(monitor.query);
    setInlineMessage(null);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: monitor.query,
          sources: monitor.sources,
          intervalMs: monitor.intervalMs,
          enabled: !monitor.enabled,
        }),
      });
      if (res.status === 401) {
        setInlineMessage("Sign in to manage monitors.");
        return;
      }
      if (!res.ok) {
        setInlineMessage("Failed to update monitor — please try again.");
        return;
      }
      await fetchData();
    } catch {
      setInlineMessage("Something went wrong — please try again.");
    } finally {
      setTogglingQuery(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(monitorQuery: string) {
    setDeletingQuery(monitorQuery);
    setInlineMessage(null);
    try {
      const res = await fetch(
        `/api/monitors?query=${encodeURIComponent(monitorQuery)}`,
        { method: "DELETE" },
      );
      if (res.status === 401) {
        setInlineMessage("Sign in to manage monitors.");
        return;
      }
      if (!res.ok) {
        setInlineMessage("Failed to delete monitor — please try again.");
        return;
      }
      await fetchData();
    } catch {
      setInlineMessage("Something went wrong — please try again.");
    } finally {
      setDeletingQuery(null);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isActive = currentMonitor !== null;
  const isPaused = isActive && !currentMonitor.enabled;
  const isLoadingGlobal = loading;

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    borderRadius: 999,
    border: `1px solid ${isActive ? "var(--buzz-500)" : "var(--border)"}`,
    font: "500 12px var(--font-sans)",
    color: isActive
      ? isPaused
        ? "var(--fg-3)"
        : "var(--buzz-500)"
      : "var(--fg-3)",
    background:
      isActive && !isPaused
        ? "rgba(var(--buzz-500-rgb, 99,102,241), 0.08)"
        : "transparent",
    cursor: isLoadingGlobal ? "default" : "pointer",
    opacity: isLoadingGlobal ? 0.6 : 1,
    transition: "border-color 120ms, color 120ms, background 120ms",
    whiteSpace: "nowrap",
  };

  const smallBtnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 9px",
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "transparent",
    font: "500 11px var(--font-sans)",
    color: "var(--fg-3)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      {/* Primary row: status pill + edit/pause for current query */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {/* The main pill button */}
        <button
          type="button"
          disabled={isLoadingGlobal}
          onClick={() => {
            if (!isActive) {
              setEditingQuery(trimmed);
              setEditing("new");
              setInlineMessage(null);
            } else {
              setEditingQuery(trimmed);
              setEditing(currentMonitor);
              setInlineMessage(null);
            }
          }}
          style={pillStyle}
          title={
            isActive
              ? isPaused
                ? "Monitor paused — click to edit"
                : "Monitoring active — click to edit"
              : "Monitor this query"
          }
        >
          <Icon name="bell" size={13} style={{ flexShrink: 0 }} />
          <span>
            {isLoadingGlobal
              ? "Loading…"
              : isActive
              ? isPaused
                ? "Monitoring · paused"
                : "Monitoring · on"
              : "Monitor this query"}
          </span>
        </button>

        {/* Pause/Resume — only when a monitor exists */}
        {isActive && !isLoadingGlobal && (
          <button
            type="button"
            onClick={() => void handleToggleEnabled(currentMonitor)}
            disabled={togglingQuery === currentMonitor.query}
            style={smallBtnStyle}
            title={isPaused ? "Resume monitoring" : "Pause monitoring"}
          >
            {togglingQuery === currentMonitor.query
              ? "…"
              : isPaused
              ? "Resume"
              : "Pause"}
          </button>
        )}

        {/* Manage list toggle */}
        {monitors.length > 0 && !isLoadingGlobal && (
          <button
            type="button"
            onClick={() => setListOpen((p) => !p)}
            style={{ ...smallBtnStyle, gap: 5 }}
            title="Manage all monitors"
          >
            Manage monitors ({monitors.length})
          </button>
        )}
      </div>

      {/* Inline error */}
      {inlineMessage && (
        <span
          style={{
            font: "500 11px var(--font-sans)",
            color: "var(--bear-500, #e05252)",
            maxWidth: 280,
            textAlign: "right",
          }}
        >
          {inlineMessage}
        </span>
      )}

      {/* Editor panel (for current query or a list-selected query) */}
      {editing !== null && (
        <MonitorEditor
          key={editing === "new" ? `new:${editingQuery}` : editing.query}
          query={editingQuery}
          existing={editing === "new" ? null : editing}
          plan={plan}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setInlineMessage(null); }}
          saving={saving}
          inlineMessage={null}
        />
      )}

      {/* Manage-all list */}
      {listOpen && monitors.length > 0 && (
        <div
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 280,
            maxWidth: 400,
          }}
        >
          <div
            style={{
              font: "600 11px var(--font-mono)",
              color: "var(--fg-4)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            All monitors
          </div>
          {monitors.map((m) => (
            <div
              key={m.query}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px 0",
                borderTop: "1px solid var(--border)",
              }}
            >
              {/* Query + pill */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span
                  style={{
                    font: "500 12px var(--font-mono)",
                    color: "var(--fg-1)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.query}
                </span>
                <span
                  style={{
                    font: "600 9px var(--font-sans)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    padding: "2px 6px",
                    borderRadius: 4,
                    background:
                      m.enabled
                        ? "rgba(var(--buzz-500-rgb, 99,102,241), 0.12)"
                        : "var(--bg-elevated)",
                    border: "1px solid var(--border)",
                    color: m.enabled ? "var(--buzz-500)" : "var(--fg-4)",
                  }}
                >
                  {m.enabled ? "on" : "paused"}
                </span>
              </div>

              {/* Sources + interval */}
              <div
                style={{
                  font: "500 11px var(--font-sans)",
                  color: "var(--fg-4)",
                }}
              >
                {m.sources
                  .map(
                    (s) =>
                      SOURCE_META.find((x) => x.id === s)?.displayName ?? s,
                  )
                  .join(", ")}{" "}
                · {intervalLabel(m.intervalMs)}
              </div>

              {/* Row actions */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditingQuery(m.query);
                    setEditing(m);
                    setInlineMessage(null);
                    setListOpen(false);
                  }}
                  style={smallBtnStyle}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleToggleEnabled(m)}
                  disabled={togglingQuery === m.query}
                  style={smallBtnStyle}
                >
                  {togglingQuery === m.query
                    ? "…"
                    : m.enabled
                    ? "Pause"
                    : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(m.query)}
                  disabled={deletingQuery === m.query}
                  style={{
                    ...smallBtnStyle,
                    color: deletingQuery === m.query ? "var(--fg-4)" : "var(--bear-500, #e05252)",
                    borderColor:
                      deletingQuery === m.query
                        ? "var(--border)"
                        : "rgba(224,82,82,0.3)",
                  }}
                >
                  {deletingQuery === m.query ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
