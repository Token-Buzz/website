// TokenBuzz · shell.jsx — Sidebar, TopBar, AppShell layout
const { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Avatar } = window.TB;

// ---------- Sidebar ----------
const NavItem = ({ icon, label, active, count, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
    borderRadius: 6, cursor: "pointer",
    background: active ? "var(--inv-bg)" : "transparent",
    color: active ? "var(--inv-fg)" : "var(--fg-2)",
    font: "500 13px/1 var(--font-sans)",
  }}>
    <Icon name={icon} size={16} />
    <span style={{ flex: 1 }}>{label}</span>
    {count != null && (
      <span style={{
        font: "500 11px/1 var(--font-mono)",
        background: active ? "rgba(255,255,255,0.12)" : "var(--bg-sunken)",
        color: active ? "var(--inv-fg)" : "var(--fg-3)",
        padding: "2px 6px", borderRadius: 999,
      }}>{count}</span>
    )}
  </div>
);

const WatchlistItem = ({ name, count, active, onClick, color = "var(--buzz-500)" }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
    borderRadius: 6, cursor: "pointer",
    background: active ? "var(--surface-active)" : "transparent",
    color: "var(--fg-1)",
    font: "500 13px/1 var(--font-sans)",
  }}>
    <span style={{ width: 6, height: 6, borderRadius: 1, background: color, flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{name}</span>
    <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--fg-3)" }}>{count}</span>
  </div>
);

const Sidebar = ({ active, setActive, watchlist, setWatchlist }) => (
  <aside style={{
    width: 240, height: "100%", padding: "16px 12px",
    borderRight: "1px solid var(--border)", background: "var(--bg)",
    display: "flex", flexDirection: "column", gap: 16,
    flexShrink: 0,
  }}>
    {/* Logo */}
    <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        background: "var(--inv-bg)", color: "var(--inv-fg)",
        fontFamily: "var(--font-display)", fontSize: 16, padding: "5px 9px 3px",
        lineHeight: 1, letterSpacing: "0.01em",
      }}>TOKENBUZZ</div>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--buzz-500)" }} />
    </div>

    {/* Search shortcut */}
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
      color: "var(--fg-3)", font: "500 12px var(--font-sans)", cursor: "pointer",
    }}>
      <Icon name="search" size={14} />
      <span style={{ flex: 1 }}>Search tokens</span>
      <kbd style={{ font: "500 10px var(--font-mono)", background: "var(--ink-100)", padding: "1px 5px", borderRadius: 3 }}>⌘K</kbd>
    </div>

    {/* Nav */}
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <NavItem icon="home" label="Today" active={active === "today"} onClick={() => setActive("today")} />
      <NavItem icon="table" label="Watchlist" active={active === "watch"} onClick={() => setActive("watch")} count="6" />
      <NavItem icon="trend" label="Movers" active={active === "movers"} onClick={() => setActive("movers")} />
      <NavItem icon="activity" label="Live feed" active={active === "feed"} onClick={() => setActive("feed")} />
      <NavItem icon="bell" label="Alerts" active={active === "alerts"} onClick={() => setActive("alerts")} count="3" />
    </div>

    {/* Watchlists */}
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 6px" }}>
        <Eyebrow>Watchlists</Eyebrow>
        <Icon name="plus" size={14} style={{ color: "var(--fg-3)", cursor: "pointer" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <WatchlistItem name="Memecoins" count="12" color="var(--buzz-500)" active={watchlist === "memecoins"} onClick={() => setWatchlist("memecoins")} />
        <WatchlistItem name="L1s" count="8" color="#6E5BA3" active={watchlist === "l1s"} onClick={() => setWatchlist("l1s")} />
        <WatchlistItem name="DeFi blue chips" count="14" color="#2E7F7B" active={watchlist === "defi"} onClick={() => setWatchlist("defi")} />
        <WatchlistItem name="VC narratives" count="6" color="#B8527E" active={watchlist === "vc"} onClick={() => setWatchlist("vc")} />
        <WatchlistItem name="AI agents" count="9" color="#C68A2E" active={watchlist === "ai"} onClick={() => setWatchlist("ai")} />
      </div>
    </div>

    {/* Footer / profile */}
    <div style={{ flex: 1 }} />
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "10px",
      borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)",
    }}>
      <Avatar name="Sam K" size={26} color="#0B0B0C" />
      <div style={{ flex: 1, lineHeight: 1.2 }}>
        <div style={{ font: "600 12px var(--font-sans)" }}>Sam Kearns</div>
        <div style={{ font: "500 11px var(--font-mono)", color: "var(--fg-3)" }}>pro · 28d left</div>
      </div>
      <Icon name="settings" size={14} style={{ color: "var(--fg-3)", cursor: "pointer" }} />
    </div>
  </aside>
);

// ---------- Top bar ----------
const TopBar = ({ window, setWindow, onAskHum, humOpen }) => (
  <header style={{
    height: 56, padding: "0 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-translucent)", backdropFilter: "blur(10px)",
    display: "flex", alignItems: "center", gap: 16,
    position: "sticky", top: 0, zIndex: 10,
  }}>
    {/* Live ticker mini */}
    <div style={{ display: "flex", alignItems: "center", gap: 14, paddingRight: 16, borderRight: "1px solid var(--border)" }}>
      <BuzzDot />
      <span style={{ font: "600 11px var(--font-sans)", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--fg-2)" }}>Live</span>
      <span style={{ font: "500 12px var(--font-mono)", color: "var(--fg-3)" }}>2,140 mentions/m · across 412 handles</span>
    </div>

    {/* Search */}
    <div style={{ flex: 1, maxWidth: 480, display: "flex", alignItems: "center", gap: 8,
      padding: "0 12px", height: 32,
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6,
      color: "var(--fg-3)" }}>
      <Icon name="search" size={14} />
      <input placeholder="Search tokens, handles, narratives..." style={{
        flex: 1, border: "none", outline: "none", background: "transparent",
        font: "500 13px var(--font-sans)", color: "var(--fg-1)" }} />
    </div>

    {/* Window segmented */}
    <div style={{ display: "inline-flex", background: "var(--ink-100)", borderRadius: 999, padding: 3, gap: 2 }}>
      {["1H", "4H", "24H", "7D"].map(w => (
        <button key={w} onClick={() => setWindow(w)} style={{
          border: "none", padding: "6px 11px", borderRadius: 999, cursor: "pointer",
          font: "600 11px var(--font-sans)",
          background: window === w ? "var(--surface)" : "transparent",
          color: window === w ? "var(--fg-1)" : "var(--fg-2)",
          boxShadow: window === w ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
        }}>{w}</button>
      ))}
    </div>

    {/* Right side */}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Button variant="ghost" size="sm" icon="bell">3</Button>
      <Button variant={humOpen ? "secondary" : "primary"} size="sm" icon="sparkle" onClick={onAskHum}>
        {humOpen ? "Hum open" : "Ask Hum"}
      </Button>
    </div>
  </header>
);

window.TBShell = { Sidebar, TopBar };
