"use client";

import { useEffect, useState } from "react";
import { Spike } from "./types";
import { Sparkline } from "./Sparkline";
import { useIsMobile } from "@/app/_hooks/useIsMobile";

export function SpikeCards() {
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchSpikes = async () => {
      try {
        const res = await fetch("/api/analytics/spikes?limit=4");
        if (!res.ok) throw new Error("Failed to fetch spikes");
        const data = await res.json();
        setSpikes(data.spikes || []);
      } catch {
        setSpikes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSpikes();
    const interval = setInterval(fetchSpikes, 30000);
    return () => clearInterval(interval);
  }, []);

  const generateSparkline = (seed: number) => {
    const points = [];
    for (let i = 0; i < 20; i++) {
      points.push(Math.sin(i * 0.2 + seed) * 50 + 50 + Math.sin(i * 1.3 + seed * 2) * 10);
    }
    return points;
  };

  const getColor = (delta: number) => {
    return delta > 0 ? "var(--data-pos)" : delta < 0 ? "var(--data-neg)" : "var(--fg-3)";
  };

  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
        Market spikes
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: "12px" }}>
        {spikes.map((spike, idx) => {
          const sparklinePoints = generateSparkline(spike.symbol.charCodeAt(0));
          const sparklineColor = getColor(spike.deltaScore);
          const isLive = idx < 2;

          return (
            <div
              key={spike.symbol}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-2)",
                padding: "16px",
                opacity: loading ? 0.5 : 1,
                transition: "opacity 200ms",
                position: "relative",
              }}
            >
              {isLive && (
                <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "var(--data-amber)", animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }} />
                  <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--data-amber)", textTransform: "uppercase" }}>Live</span>
                </div>
              )}

              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--fg-1)", marginBottom: "12px" }}>
                ${spike.symbol}
              </div>

              <div style={{ marginBottom: "12px", height: "50px" }}>
                <Sparkline points={sparklinePoints} color={sparklineColor} width={200} height={50} fill={true} />
              </div>

              <div style={{ fontSize: "18px", fontWeight: 600, color: sparklineColor, marginBottom: "8px" }}>
                {spike.deltaScore > 0 ? "+" : ""}{spike.deltaScore.toFixed(1)}%
              </div>

              <div style={{ fontSize: "12px", color: "var(--fg-3)", marginBottom: "12px" }}>
                {spike.currentMentions.toLocaleString()} mentions
              </div>

              <button
                style={{ width: "100%", padding: "8px", fontSize: "12px", fontWeight: 500, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", borderRadius: "var(--r-1)", cursor: "pointer", transition: "all 200ms" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255, 107, 44, 0.1)";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                }}
              >
                Open →
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
