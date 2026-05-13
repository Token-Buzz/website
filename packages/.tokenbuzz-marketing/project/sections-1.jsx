// TokenBuzz · Marketing sections — landing page
const { MIcon, MButton, MEyebrow, MDisplay, MHeading, Stat, LiveTicker, BuzzDotM, Wordmark } = window.M;
const { useState } = React;

// =========================================================
// NAV
// =========================================================
const Nav = ({ onCTAClick }) => (
  <nav data-screen-label="nav" style={{
    position: "sticky", top: 0, zIndex: 50,
    padding: "14px 32px",
    background: "var(--bg-translucent)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderBottom: "1px solid var(--border-hairline)",
    display: "flex", alignItems: "center", gap: 24,
  }}>
    <a href="#" style={{ textDecoration: "none" }}>
      <Wordmark size={18} suffix=".APP" />
    </a>
    <div style={{ flex: 1 }} />
    <div className="nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
      {[
        { l: "Features", h: "#features" },
        { l: "Pricing", h: "#pricing" },
        { l: "FAQ", h: "#faq" },
      ].map(it =>
        <a key={it.l} href={it.h} style={{
          font: "500 14px var(--font-sans)", color: "var(--fg-2)",
          textDecoration: "none", letterSpacing: "-0.005em",
        }}>{it.l}</a>
      )}
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <MButton variant="link" size="md" style={{ padding: "10px 12px" }} onClick={onCTAClick}>Sign in</MButton>
      <MButton variant="primary" size="md" iconRight="arrowR" onClick={onCTAClick}>Get started</MButton>
    </div>
  </nav>
);

// =========================================================
// HERO
// =========================================================
const Hero = ({ onCTAClick }) => (
  <section data-screen-label="hero" style={{
    padding: "72px 32px 40px",
    maxWidth: 1280, margin: "0 auto",
    display: "grid", gridTemplateColumns: "1.1fr 0.95fr", gap: 56, alignItems: "center",
  }} className="hero-grid">
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <BuzzDotM />
        <MEyebrow style={{ color: "var(--accent)" }}>Live · 2,140 mentions/min</MEyebrow>
      </div>
      <MDisplay size="xl" style={{ fontSize: "clamp(48px, 7vw, 84px)" }} className="hero-display">
        Hear<br/>the market<br/>before you<br/><span style={{ color: "var(--buzz-500)" }}>see</span> it.
      </MDisplay>
      <div style={{
        font: "400 18px/1.55 var(--font-sans)", color: "var(--fg-2)",
        maxWidth: 520, textWrap: "pretty",
      }}>
        TokenBuzz tracks real-time buzz, sentiment, and mentions across X for any token or keyword. The chart catches up later.
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
        <MButton variant="primary" size="lg" iconRight="arrowR" onClick={onCTAClick}>Start tracking — free</MButton>
        <MButton variant="ghost" size="lg" icon="play" onClick={onCTAClick}>See how it works</MButton>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ font: "500 12px var(--font-mono)", color: "var(--fg-3)", letterSpacing: "0.06em" }}>Trusted by analysts at</span>
        <div style={{ display: "flex", gap: 18, opacity: 0.78, flexWrap: "wrap" }}>
          {["JUMP", "CMS", "PARADIGM", "DRAGONFLY", "FRAMEWORK"].map(l =>
            <span key={l} style={{ font: "700 13px var(--font-sans)", letterSpacing: "0.16em", color: "var(--fg-2)" }}>{l}</span>
          )}
        </div>
      </div>
    </div>

    <HeroPanel />
  </section>
);

const HeroPanel = () => (
  <div className="hero-panel" style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    borderRadius: 14, padding: 0, overflow: "hidden",
    boxShadow: "0 30px 60px -20px rgba(11,11,12,0.45), 0 0 0 1px rgba(11,11,12,0.08)",
    fontFamily: "var(--font-mono)",
    transform: "rotate(0.4deg)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--data-line)" }}>
      <BuzzDotM />
      <span style={{ font: "600 10px var(--font-sans)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--data-dim)" }}>Live feed · 14:02 UTC</span>
      <div style={{ flex: 1 }} />
      <span style={{ font: "500 11px var(--font-mono)", color: "var(--data-dim)" }}>3 tokens spiking</span>
    </div>

    <div style={{ padding: "22px 22px 14px" }}>
      <div style={{ font: "600 10px var(--font-sans)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--data-dim)", marginBottom: 8 }}>$PEPE · Δ buzz · 4h</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ font: "700 56px/1 var(--font-mono)", color: "var(--data-amber)", letterSpacing: "-0.02em" }}>+412%</span>
        <span style={{ font: "600 14px var(--font-mono)", color: "var(--data-pos)" }}>▲ 48.9k mentions</span>
      </div>
      <svg viewBox="0 0 400 100" width="100%" height="100" style={{ marginTop: 10, display: "block" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--data-amber)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--data-amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M0 90 L40 85 L80 80 L120 70 L160 60 L200 55 L240 45 L280 30 L320 20 L360 10 L400 6 L400 100 L0 100 Z" fill="url(#hg)" />
        <path d="M0 90 L40 85 L80 80 L120 70 L160 60 L200 55 L240 45 L280 30 L320 20 L360 10 L400 6" stroke="var(--data-amber)" strokeWidth="2" fill="none" strokeLinejoin="round" />
      </svg>
    </div>

    <div style={{ borderTop: "1px solid var(--data-line)" }}>
      {[
        { h: "@cobie", t: "watching $PEPE accumulate again. four wallets I tagged in march are buying.", time: "2m" },
        { h: "@hsaka", t: "$PEPE volume on coinbase pro is the cleanest it's been since may.", time: "8m" },
        { h: "@gainzy222", t: "i still think $PEPE 2x from here before the cycle ends", time: "12m" },
      ].map((m, i) => (
        <div key={i} style={{ padding: "10px 16px", borderBottom: i < 2 ? "1px solid var(--data-line)" : "none", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ width: 16, height: 16, borderRadius: 8, background: "#34343A", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
              <span style={{ font: "600 11px var(--font-mono)", color: "var(--data-fg)" }}>{m.h}</span>
              <span style={{ font: "500 10px var(--font-mono)", color: "var(--data-dim)" }}>· {m.time}</span>
            </div>
            <div style={{ font: "400 11px/1.45 var(--font-sans)", color: "#F6E9D4" }}>{m.t}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// =========================================================
// SOCIAL PROOF STRIP — Stats
// =========================================================
const StatStrip = () => (
  <section data-screen-label="stats" style={{ padding: "0 32px" }}>
    <div className="stat-strip" style={{
      maxWidth: 1280, margin: "0 auto",
      borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      padding: "32px 0", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24,
    }}>
      <Stat value="14,820" label="Traders tracking" />
      <Stat value="3.4B" label="Mentions ingested" />
      <Stat value="12s" label="Median spike-to-alert" color="var(--buzz-500)" />
      <Stat value="412k" label="Handles watched" />
    </div>
  </section>
);

window.MSections1 = { Nav, Hero, StatStrip, HeroPanel };
