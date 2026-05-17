"use client";

import { useEffect, useState } from "react";
import { PulsePoint, Spike } from "./types";
import { Sparkline } from "./Sparkline";
import { fmtCount } from "./utils";

type TimeRange = "15m" | "1h" | "4h";

const timeRangeMinutes: Record<TimeRange, number> = {
  "15m": 15,
  "1h": 60,
  "4h": 240,
};

export function PulseSection() {
  const [range, setRange] = useState<TimeRange>("1h");
  const [pulse, setPulse] = useState<PulsePoint[]>([]);
  const [spikes, setSpikes] = useState<Spike[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const minutes = timeRangeMinutes[range];
        const [pulseRes, spikesRes] = await Promise.all([
          fetch(`/api/analytics/pulse?query=PEPE&minutes=${minutes}`),
          fetch("/api/analytics/spikes?limit=3"),
        ]);

        if (pulseRes.ok) {
          const pulseData = await pulseRes.json();
          setPulse(pulseData.series || []);
        }

        if (spikesRes.ok) {
          const spikesData = await spikesRes.json();
          setSpikes(spikesData.spikes || []);
        }
      } catch {
        setPulse([]);
        setSpikes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [range]);

  const currentCount = pulse.length > 0 ? pulse[pulse.length - 1].count : 0;
  const avgCount = pulse.length > 0 ? Math.round(pulse.reduce((sum, p) => sum + p.count, 0) / pulse.length) : 0;
  const change = avgCount > 0 ? Math.round(((currentCount - avgCount) / avgCount) * 100) : 0;

  const sparklinePoints = pulse.map((p) => p.count);
  const sparklineColor = change > 0 ? "var(--pos)" : change < 0 ? "var(--neg)" : "var(--fg-3)";

  return (
    <div style={{ marginBottom: "32px" }}>
      <div
        style={{
          background: "var(--data-bg)",
          border: "1px solid rgba(255, 107, 44, 0.2)",
          borderRadius: "var(--r-2)",
          padding: "24px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--data-amber)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              Buzz Pulse
            </div>
            <div style={{ fontSize: "14px", color: "var(--data-fg)", opacity: 0.7 }}>
              Real-time mention activity for PEPE
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["15m", "1h", "4h"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: "6px 12px",
                  fontSize: "12px",
                  fontWeight: 500,
                  border: "1px solid",
                  borderColor: range === r ? "var(--data-amber)" : "rgba(255, 107, 44, 0.2)",
                  background: range === r ? "rgba(255, 107, 44, 0.1)" : "transparent",
                  color: range === r ? "var(--data-amber)" : "var(--data-fg)",
                  borderRadius: "var(--r-1)",
                  cursor: "pointer",
                  transition: "all 200ms",
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Metric row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div style={{ borderRight: "1px solid rgba(255, 107, 44, 0.1)", paddingRight: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--data-fg)", opacity: 0.6, marginBottom: "6px" }}>
              Current mentions/min
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--data-amber)" }}>
              {loading ? "—" : fmtCount(currentCount)}
            </div>
          </div>
          <div style={{ borderRight: "1px solid rgba(255, 107, 44, 0.1)", paddingRight: "16px" }}>
            <div style={{ fontSize: "11px", color: "var(--data-fg)", opacity: 0.6, marginBottom: "6px" }}>
              Average
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--data-fg)" }}>
              {loading ? "—" : fmtCount(avgCount)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--data-fg)", opacity: 0.6, marginBottom: "6px" }}>
              Change from avg
            </div>
            <div style={{ fontSize: "20px", fontWeight: 600, color: sparklineColor }}>
              {loading ? "—" : `${change > 0 ? "+" : ""}${change}%`}
            </div>
          </div>
        </div>

        {/* Chart */}
        {!loading && sparklinePoints.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <Sparkline points={sparklinePoints} color={sparklineColor} width={400} height={100} fill={true} />
          </div>
        )}

        {loading && (
          <div style={{ height: "100px", background: "rgba(255, 107, 44, 0.05)", borderRadius: "var(--r-1)", marginBottom: "24px" }} />
        )}

        {/* Loudest right now */}
        <div style={{ borderTop: "1px solid rgba(255, 107, 44, 0.1)", paddingTop: "16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--data-amber)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
            Loudest right now
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {spikes.slice(0, 3).map((spike) => (
              <div
                key={spike.symbol}
                style={{
                  background: "rgba(255, 107, 44, 0.1)",
                  border: "1px solid rgba(255, 107, 44, 0.2)",
                  borderRadius: "var(--r-1)",
                  padding: "6px 10px",
                  fontSize: "12px",
                  color: "var(--data-fg)",
                }}
              >
                ${spike.symbol}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
