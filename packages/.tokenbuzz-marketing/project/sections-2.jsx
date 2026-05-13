// TokenBuzz · Marketing sections part 2 — Features, HowItWorks
const { MIcon, MButton, MEyebrow, MDisplay, MHeading, Stat, BuzzDotM } = window.M;

// =========================================================
// FEATURES — 4 features per brief
// =========================================================
const FeatureCard = ({ icon, kicker, title, body, accent, children }) => (
  <div className="feature-card" style={{
    background: "var(--surface)", border: "1px solid var(--border)",
    borderRadius: 14, padding: 24,
    display: "flex", flexDirection: "column", gap: 14,
    transition: "transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: accent ? "var(--buzz-500)" : "var(--inv-bg)",
        color: accent ? "#fff" : "var(--inv-fg)",
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <MIcon name={icon} size={18} />
      </div>
      <span style={{ font: "600 11px var(--font-mono)", color: "var(--fg-3)", letterSpacing: "0.14em", textTransform: "uppercase" }}>{kicker}</span>
    </div>
    <div style={{ font: "600 22px/1.2 var(--font-sans)", letterSpacing: "-0.012em", color: "var(--fg-1)" }}>{title}</div>
    <div style={{ font: "400 14px/1.55 var(--font-sans)", color: "var(--fg-2)", textWrap: "pretty" }}>{body}</div>
    {children && <div style={{ marginTop: 6 }}>{children}</div>}
  </div>
);

// Per-feature visuals — tiny in-card data mocks
const Viz_Tracking = () => (
  <div style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    borderRadius: 10, padding: "14px 14px 10px",
    fontFamily: "var(--font-mono)", fontSize: 11,
    border: "1px solid var(--data-line)",
  }}>
    {[
      { k: "$PEPE",   v: "+412%", c: "var(--data-pos)", w: "98%" },
      { k: "$WIF",    v: "+84%",  c: "var(--data-pos)", w: "62%" },
      { k: "$BONK",   v: "+7%",   c: "var(--data-amber)", w: "22%" },
      { k: "$SOL",    v: "−18%",  c: "var(--data-neg)", w: "18%" },
    ].map((r, i) => (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "56px 1fr 56px", gap: 8, alignItems: "center", padding: "5px 0" }}>
        <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>{r.k}</span>
        <div style={{ background: "var(--data-line)", height: 5, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ width: r.w, height: "100%", background: r.c, borderRadius: 4 }} />
        </div>
        <span style={{ color: r.c, fontWeight: 600, textAlign: "right" }}>{r.v}</span>
      </div>
    ))}
  </div>
);

const Viz_Sentiment = () => (
  <div style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    borderRadius: 10, padding: "14px",
    fontFamily: "var(--font-mono)", fontSize: 11,
    border: "1px solid var(--data-line)",
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "var(--data-dim)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
      <span>Sentiment · 24h</span><span>$PEPE</span>
    </div>
    {/* sentiment stacked bar */}
    <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ width: "62%", background: "var(--data-pos)" }} />
      <div style={{ width: "26%", background: "var(--data-amber)" }} />
      <div style={{ width: "12%", background: "var(--data-neg)" }} />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
      <div><span style={{ color: "var(--data-pos)" }}>● </span><span style={{ color: "var(--data-dim)" }}>bull</span> <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>62%</span></div>
      <div><span style={{ color: "var(--data-amber)" }}>● </span><span style={{ color: "var(--data-dim)" }}>neu</span> <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>26%</span></div>
      <div><span style={{ color: "var(--data-neg)" }}>● </span><span style={{ color: "var(--data-dim)" }}>bear</span> <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>12%</span></div>
    </div>
  </div>
);

const Viz_Watchlist = () => (
  <div style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    borderRadius: 10, padding: "10px 12px",
    fontFamily: "var(--font-mono)", fontSize: 11,
    border: "1px solid var(--data-line)",
  }}>
    {[
      { k: "$MOG",  p: "$0.0000018", d: "+41.2%", c: "var(--data-pos)", spark: "M0 18 L8 16 L16 14 L24 11 L32 5 L40 3" },
      { k: "$TURBO", p: "$0.0041",   d: "+8.07%",  c: "var(--data-pos)", spark: "M0 14 L8 13 L16 11 L24 12 L32 9 L40 8" },
      { k: "$BRETT", p: "$0.092",    d: "−1.18%",  c: "var(--data-neg)", spark: "M0 8 L8 9 L16 11 L24 10 L32 13 L40 14" },
    ].map((r, i) => (
      <div key={i} style={{ display: "grid", gridTemplateColumns: "52px 60px 1fr 50px", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: i < 2 ? "1px solid var(--data-line)" : "none" }}>
        <span style={{ color: "var(--data-fg)", fontWeight: 600 }}>{r.k}</span>
        <span style={{ color: "var(--data-dim)" }}>{r.p}</span>
        <svg viewBox="0 0 40 20" width="100%" height="16" preserveAspectRatio="none">
          <path d={r.spark} fill="none" stroke={r.c} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ color: r.c, fontWeight: 600, textAlign: "right" }}>{r.d}</span>
      </div>
    ))}
  </div>
);

const Viz_Hum = () => (
  <div style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    borderRadius: 10, padding: "12px 14px",
    fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.6,
    border: "1px solid var(--data-line)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "var(--data-dim)", letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 10 }}>
      <span style={{ background: "var(--inv-bg)", color: "var(--inv-fg)", padding: "2px 5px", borderRadius: 3, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>HUM</span>
      <span>· 3 sources</span>
    </div>
    <div style={{ color: "var(--data-fg)" }}>
      <span style={{ color: "var(--data-amber)" }}>$MOG</span> buzz is up 218% but it's all one cluster — six new wallets, same handle network. I'd watch but wouldn't chase yet.
      <span style={{ display: "inline-block", width: 8, height: 12, background: "var(--accent)", verticalAlign: "middle", marginLeft: 2, animation: "tb-cursor 1s steps(2) infinite" }} />
    </div>
  </div>
);

const Features = () => (
  <section id="features" data-screen-label="features" style={{ padding: "96px 32px 64px", maxWidth: 1280, margin: "0 auto" }}>
    <div className="features-header" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, marginBottom: 48 }}>
      <div>
        <MEyebrow style={{ marginBottom: 16 }}>What you get</MEyebrow>
        <MHeading>Bloomberg precision.<br />Without the Bloomberg.</MHeading>
      </div>
      <div style={{ font: "400 17px/1.55 var(--font-sans)", color: "var(--fg-2)", maxWidth: 520, alignSelf: "end", textWrap: "pretty" }}>
        Every other crypto tool tells you the chart moved. We tell you who started talking about it twenty minutes earlier — and whether they've ever been right.
      </div>
    </div>
    <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
      <FeatureCard
        icon="pulse" kicker="01 · Real-time tracking" accent
        title="Track buzz on X, second by second."
        body="Mention counts, reach, and velocity for any token or keyword across 412k tracked X handles. Updated every 12 seconds — alerts fire the moment a curve breaks."
      >
        <Viz_Tracking />
      </FeatureCard>
      <FeatureCard
        icon="chart" kicker="02 · Sentiment"
        title="Bull, bear, or just loud."
        body="Per-token sentiment scored over time. Trained on 18 months of post-and-price data, not naive keyword polarity. See the mood shift before the price does."
      >
        <Viz_Sentiment />
      </FeatureCard>
      <FeatureCard
        icon="star" kicker="03 · Watchlist"
        title="Your tokens, with social overlays."
        body="A personal watchlist that pairs price with social signal. See mention velocity, sentiment, and reach right next to the candle. Group by narrative. Export to CSV."
      >
        <Viz_Watchlist />
      </FeatureCard>
      <FeatureCard
        icon="cpu" kicker="04 · Ask Hum"
        title="The AI that's read every post."
        body="Hum is the research assistant that summarizes narratives, flags emerging trends, and cites every source by handle. It says “I'd watch this” — not “I think you might want to consider.”"
      >
        <Viz_Hum />
      </FeatureCard>
    </div>
  </section>
);

// =========================================================
// HOW IT WORKS — 3-step
// =========================================================
const HowItWorks = ({ onCTAClick }) => (
  <section id="how" data-screen-label="how" style={{ background: "var(--data-bg)", color: "var(--data-fg)", padding: "96px 32px" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <MEyebrow style={{ color: "var(--data-amber)", marginBottom: 16 }}>How it works · 3 steps</MEyebrow>
      <MHeading style={{ color: "var(--data-fg)", maxWidth: 820, marginBottom: 56, fontSize: 44 }}>
        The market is loud. We sort the loud into signal.
      </MHeading>
      <div className="how-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
        {[
          {
            n: "01", t: "Add a keyword or token",
            b: "Type a ticker, project name, or even a narrative. We start ingesting matching posts from 412k X handles immediately — no waiting.",
            visual: <StepVisual_Add />,
          },
          {
            n: "02", t: "Watch the buzz unfold",
            b: "Mentions are scored by reach, accuracy, and novelty. Spikes are flagged. Sentiment shifts live. The feed updates faster than the chart.",
            visual: <StepVisual_Watch />,
          },
          {
            n: "03", t: "Ask Hum what it means",
            b: "Need a second opinion? Hum reads every post in the window, surfaces the narrative, and cites the handles driving it. Five seconds, every source.",
            visual: <StepVisual_Ask />,
          },
        ].map(s => (
          <div key={s.n} style={{
            borderTop: "1px solid var(--data-line)", paddingTop: 24,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ font: "600 13px var(--font-mono)", color: "var(--data-amber)" }}>{s.n}</span>
              <span style={{ font: "500 10px var(--font-mono)", color: "var(--data-dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Step</span>
            </div>
            <div style={{ height: 130 }}>{s.visual}</div>
            <div style={{ font: "600 22px/1.2 var(--font-sans)", color: "var(--data-fg)", letterSpacing: "-0.012em" }}>{s.t}</div>
            <div style={{ font: "400 14px/1.6 var(--font-sans)", color: "var(--data-dim)", textWrap: "pretty" }}>{s.b}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 56, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <MButton variant="primary" size="lg" iconRight="arrowR" onClick={onCTAClick}>Start tracking — free</MButton>
        <span style={{ font: "500 12px var(--font-mono)", color: "var(--data-dim)", letterSpacing: "0.06em" }}>No credit card. 5 tokens free, forever.</span>
      </div>
    </div>
  </section>
);

const StepVisual_Add = () => (
  <div style={{
    border: "1px solid var(--data-line)", borderRadius: 8, padding: "10px 12px",
    fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--data-fg)",
    display: "flex", alignItems: "center", gap: 8,
    background: "rgba(0,0,0,0.2)",
  }}>
    <span style={{ color: "var(--data-amber)" }}>＋</span>
    <span style={{ color: "var(--data-fg)" }}>$PEPE</span>
    <span style={{ width: 1, height: 16, background: "var(--accent)", animation: "tb-cursor 1s steps(2) infinite" }} />
    <div style={{ flex: 1 }} />
    <span style={{ fontSize: 10, color: "var(--data-dim)", letterSpacing: "0.14em", textTransform: "uppercase" }}>↵ track</span>
  </div>
);

const StepVisual_Watch = () => (
  <svg viewBox="0 0 300 130" width="100%" height="100%" preserveAspectRatio="none">
    <defs>
      <linearGradient id="sw" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--data-amber)" stopOpacity="0.35" />
        <stop offset="100%" stopColor="var(--data-amber)" stopOpacity="0" />
      </linearGradient>
    </defs>
    {/* horizontal guides */}
    {[26, 65, 104].map(y => <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="var(--data-line)" strokeDasharray="2 4" />)}
    <path d="M0 110 L30 105 L60 95 L90 92 L120 78 L150 70 L180 55 L210 40 L240 22 L270 14 L300 8 L300 130 L0 130 Z" fill="url(#sw)" />
    <path d="M0 110 L30 105 L60 95 L90 92 L120 78 L150 70 L180 55 L210 40 L240 22 L270 14 L300 8" stroke="var(--data-amber)" strokeWidth="2" fill="none" strokeLinejoin="round" />
    <circle cx="300" cy="8" r="4" fill="var(--accent)">
      <animate attributeName="r" values="4;7;4" dur="1.8s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const StepVisual_Ask = () => (
  <div style={{
    border: "1px solid var(--data-line)", borderRadius: 8, padding: "10px 12px",
    fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.55,
    color: "var(--data-fg)", background: "rgba(0,0,0,0.2)",
    display: "flex", flexDirection: "column", gap: 6,
  }}>
    <div style={{ color: "var(--data-dim)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>You</div>
    <div>What's pushing $PEPE today?</div>
    <div style={{ color: "var(--data-amber)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 2 }}>Hum</div>
    <div>Three big wallets surfaced overnight. @cobie + 2 others. Same cluster as the March run.</div>
  </div>
);

window.MSections2 = { Features, HowItWorks };
