// TokenBuzz · primitives.jsx
// Atomic UI elements shared across the kit. Pulls tokens from ../../colors_and_type.css.
const { useState, useEffect, useRef } = React;

// ---------- Icon ----------
// Hand-built tiny set; matches Lucide @ 1.5px stroke. Each entry = array of path 'd' strings.
const ICONS = {
  search: ["M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z", "M21 21l-4.3-4.3"],
  bell:   ["M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10 21a2 2 0 0 0 4 0"],
  star:   ["M12 2l3 6.5 7 .8-5 4.7L18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5z"],
  table:  ["M3 3h18v18H3z", "M3 9h18", "M9 21V9"],
  trend:  ["M3 17l6-6 4 4 8-8", "M14 7h7v7"],
  user:   ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  settings:["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.7 1.7 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"],
  plus:   ["M12 5v14", "M5 12h14"],
  send:   ["M22 2L11 13", "M22 2l-7 20-4-9-9-4z"],
  close:  ["M18 6L6 18", "M6 6l12 12"],
  chevR:  ["M9 18l6-6-6-6"],
  chevD:  ["M6 9l6 6 6-6"],
  filter: ["M22 3H2l8 9.5V19l4 2v-8.5L22 3z"],
  sparkle:["M12 3v3", "M12 18v3", "M3 12h3", "M18 12h3", "M5.6 5.6l2.1 2.1", "M16.3 16.3l2.1 2.1", "M5.6 18.4l2.1-2.1", "M16.3 7.7l2.1-2.1"],
  home:   ["M3 11l9-8 9 8", "M5 9v11h14V9"],
  list:   ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  activity:["M3 12h4l3-9 4 18 3-9h4"],
};

const Icon = ({ name, size = 20, ...rest }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      strokeLinejoin="round" {...rest}>
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
};

// ---------- Button ----------
const Button = ({ variant = "primary", size = "md", icon, children, onClick, style, ...rest }) => {
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600,
    border: "1px solid transparent",
    borderRadius: size === "sm" ? 4 : 6,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
    transition: "all 120ms cubic-bezier(0.2, 0.7, 0.2, 1)",
    letterSpacing: "-0.005em", lineHeight: 1,
    fontSize: size === "sm" ? 12 : size === "lg" ? 16 : 14,
    padding: size === "sm" ? "6px 10px" : size === "lg" ? "12px 20px" : "9px 14px",
  };
  const variants = {
    primary:   { background: "var(--buzz-500)", color: "#fff" },
    secondary: { background: "var(--inv-bg)", color: "var(--inv-fg)" },
    ghost:     { background: "transparent", color: "var(--fg-1)", borderColor: "var(--border-strong)" },
    quiet:     { background: "transparent", color: "var(--fg-2)" },
    danger:    { background: "var(--bear-500)", color: "#fff" },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
};

// ---------- Eyebrow ----------
const Eyebrow = ({ children, style }) => (
  <div style={{ font: "600 11px/1.2 var(--font-sans)", letterSpacing: "0.18em",
    textTransform: "uppercase", color: "var(--fg-3)", ...style }}>{children}</div>
);

// ---------- Ticker pill ----------
const Ticker = ({ symbol, variant = "light", size = "md" }) => {
  const styles = {
    fontFamily: "var(--font-mono)", fontWeight: 600,
    fontSize: size === "sm" ? 11 : 12,
    padding: size === "sm" ? "3px 6px" : "4px 8px",
    borderRadius: 4,
    background: variant === "dark" ? "var(--inv-bg)" : "var(--bg-sunken)",
    color: variant === "dark" ? "var(--inv-fg)" : "var(--fg-1)",
    border: `1px solid ${variant === "dark" ? "var(--inv-border)" : "var(--border)"}`,
    display: "inline-block", letterSpacing: "-0.01em",
  };
  return <span style={styles}>{symbol.startsWith("$") ? symbol : "$" + symbol}</span>;
};

// ---------- Pill (status) ----------
const Pill = ({ tone = "ink", live, children, style }) => {
  const tones = {
    ink:  { background: "var(--inv-bg)", color: "var(--inv-fg)" },
    accent: { background: "var(--buzz-500)", color: "#fff" },
    bull: { background: "var(--bull-100)", color: "var(--bull-500)" },
    bear: { background: "var(--bear-100)", color: "var(--bear-500)" },
    neu:  { background: "var(--neutral-100)", color: "var(--neutral-500)" },
    ghost:{ background: "transparent", color: "var(--fg-3)", border: "1px solid var(--ink-200)" },
  };
  return (
    <span style={{
      font: "600 11px/1 var(--font-sans)", letterSpacing: "0.12em",
      textTransform: "uppercase", padding: "5px 9px", borderRadius: 999,
      display: "inline-flex", alignItems: "center", gap: 5, ...tones[tone], ...style }}>
      {live && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />}
      {children}
    </span>
  );
};

// ---------- BuzzDot (the live indicator) ----------
const BuzzDot = ({ pulsing = true }) => (
  <span style={{ position: "relative", display: "inline-block", width: 8, height: 8 }}>
    <span style={{
      position: "absolute", inset: 0, borderRadius: "50%", background: "var(--buzz-500)",
      animation: pulsing ? "tb-pulse 1.8s cubic-bezier(0.3, 1.4, 0.4, 1) infinite" : "none",
      boxShadow: "0 0 0 3px rgba(255,107,44,0.22)" }} />
  </span>
);

// ---------- Sparkline ----------
const Sparkline = ({ points, color = "var(--pos)", width = 120, height = 28, fill = false }) => {
  const xs = points.length - 1;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => {
    const x = (i / xs) * width;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const fillPath = fill ? `${path} L${width},${height} L0,${height} Z` : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {fill && <path d={fillPath} fill={color} opacity="0.12" />}
      <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ---------- Delta number ----------
const Delta = ({ value, format = "pct", style }) => {
  const positive = value > 0;
  const color = value === 0 ? "var(--neu)" : positive ? "var(--pos)" : "var(--neg)";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const txt = format === "pct" ? `${sign}${abs.toFixed(abs < 10 ? 2 : 1)}%`
            : format === "x"   ? `${sign}${abs.toFixed(1)}×`
            : `${sign}${abs}`;
  return <span style={{ color, fontFamily: "var(--font-mono)", fontWeight: 600,
    fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em", ...style }}>{txt}</span>;
};

// ---------- Avatar ----------
const Avatar = ({ name, size = 24, color }) => {
  const initials = name.split(/\s+/).map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const bg = color || ["#4F8A4A", "#C8462E", "#C68A2E", "#6E5BA3", "#2E7F7B", "#B8527E"][name.charCodeAt(0) % 6];
  return <div style={{
    width: size, height: size, borderRadius: "50%", background: bg, color: "#fff",
    display: "grid", placeItems: "center", fontFamily: "var(--font-sans)",
    fontWeight: 600, fontSize: size * 0.42, flexShrink: 0 }}>{initials}</div>;
};

window.TB = { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Sparkline, Delta, Avatar };
