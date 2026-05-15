// TokenBuzz · watchlist.jsx
const { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Sparkline, Delta } = window.TB;

// Sample data — deterministic, hand-tuned to look real
const TOKENS = [
  { sym: "PEPE", name: "Pepe", price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: "bull", spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
  { sym: "TURBO", name: "Turbo", price: 0.0041, d24: 8.07, mentions: 3100, dbuzz: 96, sent: "bull", spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true },
  { sym: "SOL", name: "Solana", price: 182.40, d24: -2.31, mentions: 12400, dbuzz: -18, sent: "bear", spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
  { sym: "BONK", name: "Bonk", price: 0.000033, d24: -4.62, mentions: 22700, dbuzz: 7, sent: "neu", spark: [12,13,12,11,12,11,11,10,11,10,10,11,10,9,10] },
  { sym: "WIF", name: "dogwifhat", price: 2.41, d24: 12.4, mentions: 9800, dbuzz: 84, sent: "bull", spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16] },
  { sym: "BRETT", name: "Brett", price: 0.092, d24: -1.18, mentions: 4400, dbuzz: 22, sent: "neu", spark: [10,11,11,10,11,11,12,11,12,12,11,12,12,12,11] },
  { sym: "MOG", name: "Mog Coin", price: 0.00000176, d24: 41.2, mentions: 6700, dbuzz: 218, sent: "bull", spark: [2,3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true },
  { sym: "DOGE", name: "Dogecoin", price: 0.171, d24: 0.42, mentions: 18900, dbuzz: -4, sent: "neu", spark: [12,12,11,12,12,12,11,12,12,12,11,12,12,12,12] },
];

const fmtPrice = (p) => {
  if (p >= 100) return `$${p.toFixed(2)}`;
  if (p >= 1) return `$${p.toFixed(3)}`;
  if (p >= 0.001) return `$${p.toFixed(4)}`;
  return `$${p.toExponential(2).replace("e-", "e-")}`.replace(/(\.\d+?)0+e/, "$1e");
};
const fmtCount = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);

const FilterBar = ({ filter, setFilter, sort, setSort }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
    borderBottom: "1px solid var(--border)", background: "var(--bg)",
  }}>
    <Eyebrow>Memecoins · 12 tokens</Eyebrow>
    <div style={{ flex: 1 }} />
    <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 2 }}>
      {["all", "bull", "bear", "live"].map(f => (
        <button key={f} onClick={() => setFilter(f)} style={{
          border: "none", padding: "5px 10px", borderRadius: 4, cursor: "pointer",
          font: "600 11px var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase",
          background: filter === f ? "var(--inv-bg)" : "transparent",
          color: filter === f ? "var(--inv-fg)" : "var(--fg-2)",
        }}>{f}</button>
      ))}
    </div>
    <Button variant="ghost" size="sm" icon="filter">Filters</Button>
    <Button variant="ghost" size="sm" icon="plus">Add token</Button>
  </div>
);

const SortHead = ({ children, k, sort, setSort, align = "left" }) => {
  const active = sort.k === k;
  return (
    <div onClick={() => setSort({ k, dir: active && sort.dir === "desc" ? "asc" : "desc" })} style={{
      font: "600 10px/1 var(--font-sans)", letterSpacing: "0.16em", textTransform: "uppercase",
      color: active ? "var(--fg-1)" : "var(--fg-3)", cursor: "pointer", textAlign: align,
      display: "flex", alignItems: "center", justifyContent: align === "right" ? "flex-end" : "flex-start", gap: 4,
    }}>
      {children}
      {active && <span style={{ fontSize: 9 }}>{sort.dir === "desc" ? "▼" : "▲"}</span>}
    </div>
  );
};

const WatchlistRow = ({ t, starred, onStar, onOpen, selected }) => {
  return (
    <div onClick={onOpen} style={{
      display: "grid",
      gridTemplateColumns: "32px 140px 1fr 120px 100px 160px 28px",
      alignItems: "center", gap: 16,
      padding: "12px 20px",
      borderBottom: "1px solid var(--border-hairline)",
      background: selected ? "var(--bg-elevated)" : "transparent",
      cursor: "pointer",
    }}>
      <div onClick={(e) => { e.stopPropagation(); onStar(); }} style={{
        color: starred ? "var(--buzz-500)" : "var(--ink-300)",
        fontSize: 16, lineHeight: 1, cursor: "pointer",
      }}>★</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Ticker symbol={t.sym} />
        <span style={{ font: "500 12px var(--font-sans)", color: "var(--fg-3)" }}>{t.name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Sparkline points={t.spark} color={t.d24 >= 0 ? "var(--pos)" : "var(--neg)"} width={180} height={28} fill />
      </div>
      <div style={{ textAlign: "right", font: "600 14px var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{fmtPrice(t.price)}</div>
      <div style={{ textAlign: "right" }}><Delta value={t.d24} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        <span style={{ font: "600 12px var(--font-mono)", color: "var(--fg-2)" }}>{fmtCount(t.mentions)}</span>
        <Delta value={t.dbuzz} style={{ fontSize: 12 }} />
        {t.live && <BuzzDot />}
      </div>
      <Icon name="chevR" size={14} style={{ color: "var(--fg-4)" }} />
    </div>
  );
};

const WatchlistTable = ({ onOpenToken, selected }) => {
  const [filter, setFilter] = React.useState("all");
  const [sort, setSort] = React.useState({ k: "dbuzz", dir: "desc" });
  const [starred, setStarred] = React.useState(new Set(["PEPE", "SOL", "WIF"]));

  let rows = TOKENS.slice();
  if (filter === "bull") rows = rows.filter(t => t.sent === "bull");
  if (filter === "bear") rows = rows.filter(t => t.sent === "bear");
  if (filter === "live") rows = rows.filter(t => t.live);
  rows.sort((a, b) => {
    const av = a[sort.k], bv = b[sort.k];
    return sort.dir === "desc" ? bv - av : av - bv;
  });

  return (
    <div>
      <FilterBar filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} />
      {/* Head */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "32px 140px 1fr 120px 100px 160px 28px",
        alignItems: "center", gap: 16,
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        position: "sticky", top: 0, zIndex: 1,
      }}>
        <div></div>
        <SortHead k="sym" sort={sort} setSort={setSort}>Ticker</SortHead>
        <SortHead k="spark" sort={sort} setSort={setSort}>15min · sparkline</SortHead>
        <SortHead k="price" sort={sort} setSort={setSort} align="right">Price</SortHead>
        <SortHead k="d24" sort={sort} setSort={setSort} align="right">24h</SortHead>
        <SortHead k="dbuzz" sort={sort} setSort={setSort} align="right">Mentions · Δ buzz</SortHead>
        <div></div>
      </div>
      {/* Body */}
      <div>
        {rows.map(t => (
          <WatchlistRow
            key={t.sym} t={t}
            starred={starred.has(t.sym)}
            onStar={() => {
              const s = new Set(starred);
              s.has(t.sym) ? s.delete(t.sym) : s.add(t.sym);
              setStarred(s);
            }}
            onOpen={() => onOpenToken(t)}
            selected={selected?.sym === t.sym}
          />
        ))}
      </div>
    </div>
  );
};

window.TBWatchlist = { WatchlistTable, TOKENS, fmtPrice, fmtCount };
