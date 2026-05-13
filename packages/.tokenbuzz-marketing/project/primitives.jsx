// TokenBuzz · Marketing primitives
const { useState, useEffect, useRef } = React;

const MIcon = ({ name, size = 20, ...rest }) => {
  const paths = {
    arrowR:  ["M5 12h14", "M13 5l7 7-7 7"],
    arrowDown: ["M6 9l6 6 6-6"],
    check:   ["M20 6L9 17l-5-5"],
    star:    ["M12 2l3 6.5 7 .8-5 4.7L18.2 21 12 17.8 5.8 21 7 14 2 9.3 9 8.5z"],
    pulse:   ["M3 12h4l3-9 4 18 3-9h4"],
    bolt:    ["M13 2L3 14h7l-1 8 11-14h-7l1-6z"],
    eye:     ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z", "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"],
    cpu:     ["M4 4h16v16H4z", "M9 9h6v6H9z", "M9 1v3", "M15 1v3", "M9 20v3", "M15 20v3", "M20 9h3", "M20 14h3", "M1 9h3", "M1 14h3"],
    chart:   ["M3 3v18h18", "M7 14l4-4 4 4 5-7"],
    play:    ["M5 3l14 9-14 9z"],
    plus:    ["M12 5v14", "M5 12h14"],
    list:    ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
    sparkle: ["M12 3l1.8 4.8L18.5 9.6l-4.8 1.8L12 16.2l-1.7-4.8L5.5 9.6l4.8-1.8z", "M19 14l.8 2.1L22 17l-2.2.8L19 20l-.8-2.1L16 17l2.2-.8z"],
    x:       ["M18 6L6 18", "M6 6l12 12"],
    twitter: ["M22 5.8c-.7.3-1.5.5-2.4.6.9-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.7 1A4.2 4.2 0 0 0 11.5 9c0 .3 0 .7.1 1A12 12 0 0 1 3 5.4a4.2 4.2 0 0 0 1.3 5.6 4 4 0 0 1-1.9-.5v.1c0 2 1.4 3.7 3.4 4.1a4 4 0 0 1-1.9.1c.5 1.7 2.1 2.9 4 2.9A8.5 8.5 0 0 1 2 19.5a12 12 0 0 0 6.5 1.9c7.8 0 12-6.4 12-12v-.6c.8-.6 1.5-1.3 2.1-2z"],
    github:  ["M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.2-1.5 6.2-6.7A5.2 5.2 0 0 0 19.9 5a4.9 4.9 0 0 0-.1-3.8s-1.2-.3-3.9 1.5a13.4 13.4 0 0 0-7 0C6.2 1 5 1.2 5 1.2A4.9 4.9 0 0 0 4.9 5a5.2 5.2 0 0 0-1.4 3.6c0 5.2 3.1 6.4 6.1 6.7A3.4 3.4 0 0 0 8.6 18v3"],
    discord: ["M9 11.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM15 11.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM7 4l-1.5.5C4 5 3 6.5 3 8v8c0 1.5 1 3 2.5 3.5L7 20l1-2c1.5.5 3 .5 4 .5s2.5 0 4-.5l1 2 1.5-.5c1.5-.5 2.5-2 2.5-3.5V8c0-1.5-1-3-2.5-3.5L17 4l-1 2c-1.5-.5-3-.5-4-.5s-2.5 0-4 .5L7 4z"],
  };
  const d = paths[name] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {d.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
};

const MButton = ({ variant = "primary", size = "md", icon, iconRight, children, onClick, href, style, ...rest }) => {
  const base = {
    fontFamily: "var(--font-sans)", fontWeight: 600,
    border: "1px solid transparent",
    borderRadius: size === "lg" ? 8 : 6, cursor: "pointer",
    display: "inline-flex", alignItems: "center", gap: 8,
    transition: "all 160ms cubic-bezier(0.2, 0.7, 0.2, 1)",
    letterSpacing: "-0.005em", lineHeight: 1,
    fontSize: size === "lg" ? 16 : 14,
    padding: size === "lg" ? "14px 22px" : "10px 16px",
    textDecoration: "none", whiteSpace: "nowrap",
  };
  const variants = {
    primary:   { background: "var(--buzz-500)", color: "#fff" },
    secondary: { background: "var(--inv-bg)", color: "var(--inv-fg)" },
    ghost:     { background: "transparent", color: "var(--fg-1)", borderColor: "var(--border-strong)" },
    inverse:   { background: "var(--bg)", color: "var(--fg-1)" },
    link:      { background: "transparent", color: "var(--fg-1)", padding: 0, border: "none" },
  };
  const Tag = href ? "a" : "button";
  return (
    <Tag onClick={onClick} href={href} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {icon && <MIcon name={icon} size={size === "lg" ? 16 : 14} />}
      {children}
      {iconRight && <MIcon name={iconRight} size={size === "lg" ? 16 : 14} />}
    </Tag>
  );
};

const MEyebrow = ({ children, color = "var(--fg-2)", style }) => (
  <div style={{
    font: "600 12px/1.2 var(--font-sans)", letterSpacing: "0.22em",
    textTransform: "uppercase", color, ...style,
  }}>{children}</div>
);

const MDisplay = ({ children, size = "xl", style }) => {
  const sizes = { xl: 84, lg: 64, md: 44 };
  return (
    <div style={{
      fontFamily: "var(--font-display)", fontSize: sizes[size],
      lineHeight: 0.98, letterSpacing: "0.005em",
      textTransform: "uppercase", color: "var(--fg-1)",
      textWrap: "balance", ...style,
    }}>{children}</div>
  );
};

const MHeading = ({ as: As = "h2", children, style }) => (
  <As style={{
    font: "600 40px/1.05 var(--font-sans)", letterSpacing: "-0.018em",
    color: "var(--fg-1)", margin: 0, textWrap: "balance", ...style,
  }}>{children}</As>
);

const Stat = ({ value, label, color = "var(--fg-1)" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{
      font: "600 44px/0.95 var(--font-mono)", fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.02em", color,
    }}>{value}</div>
    <div style={{ font: "500 12px var(--font-sans)", letterSpacing: "0.14em",
      textTransform: "uppercase", color: "var(--fg-3)" }}>{label}</div>
  </div>
);

// LiveTicker — horizontal scrolling marquee of $TICKERs with deltas
const LiveTicker = ({ items }) => (
  <div style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    overflow: "hidden", padding: "12px 0", position: "relative",
    borderTop: "1px solid var(--data-line)", borderBottom: "1px solid var(--data-line)",
  }}>
    <div style={{
      display: "flex", gap: 36, whiteSpace: "nowrap",
      animation: "tb-marquee 38s linear infinite",
      width: "max-content",
    }}>
      {[...items, ...items].map((it, i) => (
        <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>${it.s}</span>
          <span style={{ color: "var(--data-dim)" }}>{it.p}</span>
          <span style={{ color: it.d >= 0 ? "var(--data-pos)" : "var(--data-neg)", fontWeight: 600 }}>
            {it.d >= 0 ? "▲" : "▼"} {it.d >= 0 ? "+" : "−"}{Math.abs(it.d).toFixed(2)}%
          </span>
          <span style={{ color: "var(--data-dim)" }}>·</span>
          <span style={{ color: "var(--data-amber)" }}>{it.b}</span>
        </div>
      ))}
    </div>
  </div>
);

const BuzzDotM = ({ size = 10 }) => (
  <span style={{
    width: size, height: size, borderRadius: "50%",
    background: "var(--buzz-500)", display: "inline-block", flexShrink: 0,
    animation: "tb-pulse 1.8s cubic-bezier(0.3, 1.4, 0.4, 1) infinite",
  }} />
);

// Wordmark — the "TOKENBUZZ.APP" block lockup
const Wordmark = ({ size = 18, suffix = ".APP" }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 6,
  }}>
    <span style={{
      background: "var(--inv-bg)", color: "var(--inv-fg)",
      fontFamily: "var(--font-display)", fontSize: size,
      padding: `${size * 0.34}px ${size * 0.56}px ${size * 0.22}px`,
      lineHeight: 1, letterSpacing: "0.02em",
    }}>TOKENBUZZ{suffix}</span>
    <BuzzDotM size={size * 0.36} />
  </div>
);

window.M = { MIcon, MButton, MEyebrow, MDisplay, MHeading, Stat, LiveTicker, BuzzDotM, Wordmark };
