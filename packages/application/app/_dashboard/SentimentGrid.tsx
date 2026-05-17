"use client";

import { useEffect, useState } from "react";
import { SentimentEntry } from "./types";

export function SentimentGrid() {
  const [sentiment, setSentiment] = useState<SentimentEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const res = await fetch("/api/analytics/sentiment?queries=PEPE");
        if (!res.ok) throw new Error("Failed to fetch sentiment");
        const data = await res.json();
        setSentiment(data.sentiment || []);
      } catch {
        setSentiment([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSentiment();
    const interval = setInterval(fetchSentiment, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (avgScore: number): { bg: string; text: string } => {
    if (avgScore > 5) {
      return { bg: "rgba(76, 175, 80, 0.1)", text: "var(--pos)" };
    }
    if (avgScore < 5) {
      return { bg: "rgba(244, 67, 54, 0.1)", text: "var(--neg)" };
    }
    return { bg: "rgba(255, 107, 44, 0.1)", text: "var(--data-amber)" };
  };

  const getSentimentLabel = (avgScore: number): string => {
    if (avgScore > 5.5) return "bull";
    if (avgScore < 4.5) return "bear";
    return "mixed";
  };

  return (
    <div style={{ marginBottom: "32px" }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px", fontSize: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--pos)" }} />
          <span style={{ color: "var(--fg-3)" }}>Bull</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--data-amber)" }} />
          <span style={{ color: "var(--fg-3)" }}>Mixed</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--neg)" }} />
          <span style={{ color: "var(--fg-3)" }}>Bear</span>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
        {sentiment.map((entry) => {
          const colors = getSentimentColor(entry.avgScore);
          const label = getSentimentLabel(entry.avgScore);

          return (
            <div
              key={entry.symbol}
              style={{
                background: colors.bg,
                border: `1px solid ${colors.text}33`,
                borderRadius: "var(--r-2)",
                padding: "16px",
                opacity: loading ? 0.5 : 1,
                transition: "opacity 200ms",
              }}
            >
              {/* Symbol */}
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--fg-3)", marginBottom: "8px", textTransform: "uppercase" }}>
                ${entry.symbol}
              </div>

              {/* Average score */}
              <div style={{ fontSize: "28px", fontWeight: 700, color: colors.text, lineHeight: 1, marginBottom: "8px" }}>
                {entry.avgScore.toFixed(1)}
              </div>

              {/* Label */}
              <div style={{ fontSize: "10px", fontWeight: 600, color: colors.text, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                {label}
              </div>

              {/* Tweet count */}
              <div style={{ fontSize: "12px", color: "var(--fg-3)" }}>
                {entry.tweetCount} tweets
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
