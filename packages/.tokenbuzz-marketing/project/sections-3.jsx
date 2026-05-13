// TokenBuzz · Marketing sections part 3 — Pricing, FAQ, CTA, Footer
const { MIcon, MButton, MEyebrow, MDisplay, MHeading, BuzzDotM, Wordmark } = window.M;
const { useState: useStateM3 } = React;

// =========================================================
// PRICING — three tiers: Free / Pro / Alpha
// =========================================================
const PriceCard = ({ tier, tagline, price, period, features, cta, featured, onCTAClick }) => (
  <div className="price-card" style={{
    background: featured ? "var(--data-bg)" : "var(--surface)",
    color: featured ? "var(--data-fg)" : "var(--fg-1)",
    border: featured ? "1px solid var(--data-bg)" : "1px solid var(--border)",
    borderRadius: 14, padding: 28, display: "flex", flexDirection: "column", gap: 18,
    position: "relative",
    transform: featured ? "translateY(-8px)" : "none",
    boxShadow: featured ? "0 30px 60px -20px rgba(11,11,12,0.45)" : "none",
  }}>
    {featured && (
      <div style={{
        position: "absolute", top: -12, right: 20,
        background: "var(--buzz-500)", color: "#fff",
        font: "600 10px var(--font-sans)", letterSpacing: "0.22em", textTransform: "uppercase",
        padding: "5px 10px", borderRadius: 4,
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <BuzzDotM size={6} /> Most popular
      </div>
    )}
    <div>
      <div style={{
        font: "600 11px var(--font-sans)", letterSpacing: "0.22em", textTransform: "uppercase",
        color: featured ? "var(--data-amber)" : "var(--fg-3)", marginBottom: 6,
      }}>{tier}</div>
      <div style={{
        font: "400 13px/1.5 var(--font-sans)",
        color: featured ? "var(--data-dim)" : "var(--fg-3)",
      }}>{tagline}</div>
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ font: "600 52px/1 var(--font-mono)", letterSpacing: "-0.02em" }}>{price}</span>
      <span style={{ font: "500 14px var(--font-mono)", color: featured ? "var(--data-dim)" : "var(--fg-3)" }}>{period}</span>
    </div>
    <div style={{ height: 1, background: featured ? "var(--data-line)" : "var(--border)" }} />
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {features.map(f => (
        <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, font: "400 14px/1.4 var(--font-sans)", color: featured ? "var(--data-fg)" : "var(--fg-1)" }}>
          <MIcon name="check" size={14} style={{ marginTop: 3, color: featured ? "var(--data-amber)" : "var(--buzz-500)", flexShrink: 0 }} />
          <span>{f}</span>
        </li>
      ))}
    </ul>
    <div style={{ flex: 1 }} />
    <MButton
      variant={featured ? "inverse" : "secondary"}
      size="md"
      iconRight="arrowR"
      onClick={onCTAClick}
    >{cta}</MButton>
  </div>
);

const Pricing = ({ onCTAClick }) => (
  <section id="pricing" data-screen-label="pricing" style={{ padding: "96px 32px 64px" }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="pricing-header" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, marginBottom: 48 }}>
        <div>
          <MEyebrow style={{ marginBottom: 16 }}>Pricing</MEyebrow>
          <MHeading>Three plans.<br/>One number.</MHeading>
        </div>
        <div style={{ font: "400 17px/1.55 var(--font-sans)", color: "var(--fg-2)", maxWidth: 520, alignSelf: "end", textWrap: "pretty" }}>
          Pay monthly. Cancel anytime. No annual lock-in, no "contact sales" tier. The Free plan covers a hobby; Pro covers a position; Alpha covers a desk.
        </div>
      </div>
      <div className="pricing-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "stretch" }}>
        <PriceCard
          tier="Free"
          tagline="For the curious. Five tokens, no card."
          price="$0"
          period="forever"
          features={[
            "5 tracked tokens",
            "1h-delayed buzz feed",
            "Daily sentiment digest",
            "Email alerts",
          ]}
          cta="Start free"
          onCTAClick={onCTAClick}
        />
        <PriceCard
          tier="Pro"
          tagline="For traders running real positions."
          price="$24"
          period="/month"
          features={[
            "Unlimited tracked tokens",
            "Real-time buzz feed (12s)",
            "Full sentiment + reputation scoring",
            "Push, email, and Discord alerts",
            "30-day mention history",
            "Mobile + web apps",
          ]}
          cta="Start tracking"
          featured
          onCTAClick={onCTAClick}
        />
        <PriceCard
          tier="Alpha"
          tagline="For desks, funds, and the impatient."
          price="$240"
          period="/month"
          features={[
            "Everything in Pro",
            "Ask Hum — unlimited queries",
            "Custom narrative tracking",
            "API access (10k req/day)",
            "Team seats (up to 5)",
            "1-year mention history + CSV export",
          ]}
          cta="Start Alpha trial"
          onCTAClick={onCTAClick}
        />
      </div>
    </div>
  </section>
);

// =========================================================
// FAQ
// =========================================================
const FAQItem = ({ q, a, open, onToggle }) => (
  <div style={{
    borderTop: "1px solid var(--border)",
    padding: "20px 0",
  }}>
    <button
      onClick={onToggle}
      style={{
        background: "none", border: "none", padding: 0, width: "100%",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        cursor: "pointer", textAlign: "left", color: "var(--fg-1)",
      }}
    >
      <span style={{ font: "600 19px/1.35 var(--font-sans)", letterSpacing: "-0.01em" }}>{q}</span>
      <span style={{
        flexShrink: 0,
        width: 32, height: 32, borderRadius: 999,
        border: "1px solid var(--border-strong)",
        display: "grid", placeItems: "center",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 200ms var(--ease-out)",
        color: "var(--fg-1)",
      }}>
        <MIcon name="arrowDown" size={16} />
      </span>
    </button>
    <div style={{
      maxHeight: open ? 320 : 0,
      overflow: "hidden",
      transition: "max-height 320ms var(--ease-in-out), opacity 200ms var(--ease-out)",
      opacity: open ? 1 : 0,
    }}>
      <div style={{
        font: "400 15px/1.6 var(--font-sans)", color: "var(--fg-2)",
        paddingTop: 14, maxWidth: 760, textWrap: "pretty",
      }}>{a}</div>
    </div>
  </div>
);

const FAQ_DATA = [
  {
    q: "What data sources do you use?",
    a: "Right now: every public post on X mentioning your tracked tokens, keywords, or handles — 412k accounts ranked by historical accuracy. We add new handles automatically when they start moving markets. We do not scrape private channels or DMs.",
  },
  {
    q: "How does the AI assistant work?",
    a: "Hum reads the same firehose you see — every relevant post in your selected window — and produces a short, sourced summary. It cites handles, links posts, and refuses questions it can't answer. It's a research tool, not a fortune teller. Trained on 18 months of post-and-price data; uses your live buzz feed as context.",
  },
  {
    q: "Is there a free trial of Pro and Alpha?",
    a: "Yes. Pro and Alpha both include a 14-day trial — no card required to start. You'll get the email reminder 3 days out; we'd rather you bounce than auto-charge.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, in one click from your account page. We do not hide the button. No annual contracts, no exit interviews, no win-back emails. Your data exports on the way out.",
  },
  {
    q: "Do you support tokens outside the top 100?",
    a: "Yes — that's most of what people track here. If a ticker has at least 50 mentions per day on X, we cover it. You can also track keywords, narratives, or handles directly (e.g. \"AI agents\" or @hsaka), independent of any one token.",
  },
  {
    q: "What about platforms beyond X — Farcaster, Discord, Reddit?",
    a: "Farcaster is in private beta — Alpha customers can opt in today. Public Discord and Telegram channels are on the roadmap for Q3. Reddit is unlikely; the signal-to-noise ratio is rough. We'll add platforms when we can do them well, not before.",
  },
];

const FAQ = () => {
  const [open, setOpen] = useStateM3(0);
  return (
    <section id="faq" data-screen-label="faq" style={{ padding: "32px 32px 96px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <div className="faq-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 64, alignItems: "start" }}>
          <div style={{ position: "sticky", top: 96 }}>
            <MEyebrow style={{ marginBottom: 16 }}>FAQ</MEyebrow>
            <MHeading style={{ fontSize: 40 }}>The questions we keep getting.</MHeading>
            <div style={{ font: "400 15px/1.55 var(--font-sans)", color: "var(--fg-2)", marginTop: 20, textWrap: "pretty" }}>
              Couldn't find what you needed? Email{" "}
              <a href="mailto:hello@tokenbuzz.app" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>hello@tokenbuzz.app</a>
              {" "}— we read everything.
            </div>
          </div>
          <div style={{ borderBottom: "1px solid var(--border)" }}>
            {FAQ_DATA.map((item, i) => (
              <FAQItem
                key={i}
                q={item.q}
                a={item.a}
                open={open === i}
                onToggle={() => setOpen(open === i ? -1 : i)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// =========================================================
// FINAL CTA
// =========================================================
const CTA = ({ onCTAClick }) => (
  <section data-screen-label="final-cta" style={{ padding: "0 32px 96px" }}>
    <div className="cta-grid" style={{
      maxWidth: 1280, margin: "0 auto",
      background: "var(--data-bg)", color: "var(--data-fg)", borderRadius: 20,
      padding: "80px 56px", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 48, alignItems: "center",
      position: "relative", overflow: "hidden",
    }}>
      {/* Buzz orange accent line in the corner */}
      <div style={{
        position: "absolute", top: 24, right: 24,
        display: "flex", alignItems: "center", gap: 8,
        font: "600 10px var(--font-sans)", letterSpacing: "0.22em", textTransform: "uppercase",
        color: "var(--data-amber)",
      }}>
        <BuzzDotM size={7} /> Live
      </div>
      <div>
        <MDisplay size="lg" style={{ marginBottom: 18, color: "var(--data-fg)", fontSize: "clamp(40px, 5vw, 64px)" }}>
          Stop staring.<br/>Start listening.
        </MDisplay>
        <div style={{ font: "400 17px/1.55 var(--font-sans)", color: "var(--data-dim)", maxWidth: 520, marginBottom: 28, textWrap: "pretty" }}>
          Five tracked tokens, free, forever. Upgrade if you want the live feed and Hum. Cancel in one click.
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MButton variant="primary" size="lg" iconRight="arrowR" onClick={onCTAClick}>Get started — it's free</MButton>
          <MButton variant="ghost" size="lg" onClick={onCTAClick} style={{ color: "var(--data-fg)", borderColor: "var(--data-line)" }}>Read the changelog</MButton>
        </div>
      </div>
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{
          background: "rgba(0,0,0,0.35)", color: "var(--data-fg)",
          fontFamily: "var(--font-mono)", padding: "20px 22px", borderRadius: 12,
          fontSize: 13, lineHeight: 1.7,
          border: "1px solid var(--data-line)",
        }}>
          <div style={{ color: "var(--data-dim)", marginBottom: 8 }}># Last hour, $PEPE</div>
          <div><span style={{ color: "var(--data-amber)" }}>buzz</span>     <span style={{ color: "var(--data-pos)" }}>+412%</span></div>
          <div><span style={{ color: "var(--data-amber)" }}>mentions</span> 48.9k <span style={{ color: "var(--data-dim)" }}>(+38 new handles)</span></div>
          <div><span style={{ color: "var(--data-amber)" }}>sent</span>     <span style={{ color: "var(--data-pos)" }}>+62</span> bullish</div>
          <div><span style={{ color: "var(--data-amber)" }}>price</span>    $0.0000182 <span style={{ color: "var(--data-pos)" }}>+24.1%</span></div>
          <div style={{ marginTop: 12, color: "var(--data-dim)" }}># the chart still hasn't moved.</div>
        </div>
      </div>
    </div>
  </section>
);

// =========================================================
// FOOTER
// =========================================================
const Footer = () => (
  <footer data-screen-label="footer" style={{
    background: "var(--data-bg)", color: "var(--data-fg)",
    padding: "72px 32px 32px",
  }}>
    <div style={{ maxWidth: 1280, margin: "0 auto" }}>
      <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1fr 1fr", gap: 48, marginBottom: 56 }}>
        <div>
          <Wordmark size={20} suffix=".APP" />
          <div style={{ font: "400 14px/1.55 var(--font-sans)", color: "var(--data-dim)", maxWidth: 340, marginTop: 18, textWrap: "pretty" }}>
            Hear the market before you see it. Built in Brooklyn by people who got tired of refreshing their column.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {[
              { i: "twitter", l: "X" },
              { i: "github", l: "GitHub" },
              { i: "discord", l: "Discord" },
            ].map(s => (
              <a key={s.i} href="#" aria-label={s.l} style={{
                width: 36, height: 36, borderRadius: 8,
                border: "1px solid var(--data-line)",
                display: "grid", placeItems: "center",
                color: "var(--data-fg)", textDecoration: "none",
              }}>
                <MIcon name={s.i} size={16} />
              </a>
            ))}
          </div>
        </div>
        {[
          { h: "Product",   l: ["Watchlist", "Live feed", "Ask Hum", "API", "Mobile apps"] },
          { h: "Company",   l: ["About", "Blog", "Press", "Careers", "Brand"] },
          { h: "Resources", l: ["Docs", "Pricing", "Status", "Security", "Changelog"] },
          { h: "Legal",     l: ["Terms", "Privacy", "Disclosures", "Contact"] },
        ].map(c => (
          <div key={c.h}>
            <div style={{ font: "600 10px var(--font-sans)", letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--data-dim)", marginBottom: 14 }}>{c.h}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {c.l.map(i => <li key={i}><a href="#" style={{ font: "500 14px var(--font-sans)", color: "var(--data-fg)", textDecoration: "none" }}>{i}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid var(--data-line)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ font: "500 12px var(--font-mono)", color: "var(--data-dim)" }}>© 2026 TokenBuzz Inc. · Not financial advice.</div>
        <div style={{ display: "flex", gap: 16, font: "500 12px var(--font-mono)", color: "var(--data-dim)", alignItems: "center" }}>
          <span>v 2.4.1</span><span>·</span>
          <span style={{ color: "var(--data-pos)", display: "inline-flex", alignItems: "center", gap: 6 }}>● All systems normal</span>
        </div>
      </div>
    </div>
  </footer>
);

window.MSections3 = { Pricing, FAQ, CTA, Footer };
