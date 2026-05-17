"use client";

import { useState } from "react";
import { KPIStrip } from "./KPIStrip";
import { PulseSection } from "./PulseSection";
import { SpikeCards } from "./SpikeCards";
import { SentimentGrid } from "./SentimentGrid";
import { TweetStream } from "./TweetStream";
import { HumPanel } from "./HumPanel";

export function DashboardShell({ firstName }: { firstName: string | null }) {
  const [humOpen, setHumOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Main content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          transition: "margin-right 300ms ease",
          marginRight: humOpen ? "380px" : "0",
        }}
      >
        {/* Header */}
        <div style={{ padding: "32px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                Welcome back
              </div>
              <h1 style={{ fontSize: "32px", fontWeight: 700, color: "var(--fg-1)", margin: 0 }}>
                {firstName ? `Hey ${firstName}` : "Dashboard"}
              </h1>
            </div>
            <button
              onClick={() => setHumOpen(!humOpen)}
              style={{
                padding: "10px 16px",
                fontSize: "13px",
                fontWeight: 600,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--fg-1)",
                borderRadius: "var(--r-1)",
                cursor: "pointer",
                transition: "all 200ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)";
                (e.currentTarget as HTMLButtonElement).style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-elevated)";
                (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-1)";
              }}
            >
              Brief me
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "32px" }}>
          <KPIStrip />
          <PulseSection />
          <SpikeCards />
          <SentimentGrid />
          <TweetStream />
        </div>
      </div>

      {/* HUM Panel */}
      {humOpen && <HumPanel onClose={() => setHumOpen(false)} />}
    </div>
  );
}
