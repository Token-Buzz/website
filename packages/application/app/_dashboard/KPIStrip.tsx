"use client";

import { useEffect, useState } from "react";
import { KPIs } from "./types";
import { fmtCount } from "./utils";
import { useIsMobile } from "@/app/_hooks/useIsMobile";

export function KPIStrip() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await fetch("/api/analytics/kpis?queries=PEPE");
        if (!res.ok) throw new Error("Failed to fetch KPIs");
        const data: KPIs = await res.json();
        setKpis(data);
      } catch {
        setKpis({ mentions24h: 0, tokenCount: 0, netSentiment: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
    const interval = setInterval(fetchKpis, 60000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { label: "Mentions · 24h", value: kpis?.mentions24h ?? 0, footer: "across all tracked tokens" },
    { label: "Tokens tracked", value: kpis?.tokenCount ?? 0, footer: "in the platform" },
    { label: "Net sentiment", value: kpis?.netSentiment ?? 0, footer: kpis && kpis.netSentiment > 0 ? "bullish" : kpis && kpis.netSentiment < 0 ? "bearish" : "neutral" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: "12px", marginBottom: "32px" }}>
      {cards.map((card, idx) => (
        <div
          key={idx}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--r-2)", padding: "16px", opacity: loading ? 0.5 : 1, transition: "opacity 200ms" }}
        >
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
            {card.label}
          </div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: "var(--fg-1)", lineHeight: 1, marginBottom: "8px" }}>
            {idx === 2 && kpis
              ? kpis.netSentiment > 0
                ? <span style={{ color: "var(--pos)" }}>+{fmtCount(Math.abs(kpis.netSentiment))}</span>
                : kpis.netSentiment < 0
                ? <span style={{ color: "var(--neg)" }}>−{fmtCount(Math.abs(kpis.netSentiment))}</span>
                : <span style={{ color: "var(--fg-3)" }}>{fmtCount(kpis.netSentiment)}</span>
              : loading ? "—" : fmtCount(card.value)}
          </div>
          <div style={{ fontSize: "12px", color: "var(--fg-3)" }}>{card.footer}</div>
        </div>
      ))}
    </div>
  );
}
