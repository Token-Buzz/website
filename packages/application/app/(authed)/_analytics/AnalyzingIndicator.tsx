"use client";

interface AnalyzingIndicatorProps {
  label?: string;
}

export function AnalyzingIndicator({ label = "Analyzing…" }: AnalyzingIndicatorProps) {
  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "20px 0",
        font: "500 12px var(--font-mono)",
        color: "var(--fg-3)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--buzz-500)",
          display: "inline-block",
          animation: "tb-pulse 1.8s cubic-bezier(0.3,1.4,0.4,1) infinite",
          boxShadow: "0 0 0 3px rgba(255,107,44,0.22)",
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}
