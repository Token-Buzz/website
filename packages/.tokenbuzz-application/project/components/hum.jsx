// TokenBuzz · hum.jsx — the AI research assistant right rail
const { Icon, Button, Eyebrow, Ticker, Pill, BuzzDot, Avatar } = window.TB;

const SAMPLE_REPLIES = {
  default: {
    text: "Three things I'd watch tonight. $PEPE just broke its 30-day mention high — first time it's correlated this tightly with on-chain accumulation since March. $MOG is being seeded by four handles that called the last memecoin run, but volume hasn't followed. $SOL chatter is bearish but the bearish handles are smaller than usual — discount that.",
    sources: ["@cobie", "@hsaka", "@gainzy222", "+ 38 more"],
  },
  pepe: {
    text: "Buzz on $PEPE is up 412% in the last 4h. Driven by accumulation talk from 6 mid-tier handles, not influencer hype. Volume on Coinbase Pro is the cleanest it's been since May. Sentiment 62/100 bullish but I'd note one bearish thread from @degenspartan worth reading.",
    sources: ["@cobie", "@hsaka", "@CryptoKaleo", "@degenspartan", "+ 24 more"],
  },
  sol: {
    text: "Quiet for $SOL. Mentions flat at 12.4k/24h, sentiment drifting bearish but the bearish posts are mostly small accounts. The real signal: fee chatter is up, which usually precedes ecosystem-token rotation. I'd watch the SOL memes, not SOL itself.",
    sources: ["@aeyakovenko", "@toly", "+ 12 more"],
  },
};

const HumBubble = ({ from = "hum", children, sources, time }) => {
  const isHum = from === "hum";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: isHum ? "flex-start" : "flex-end" }}>
      {isHum && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            background: "var(--inv-bg)", color: "var(--inv-fg)",
            fontFamily: "var(--font-display)", fontSize: 11, padding: "3px 7px 2px",
            lineHeight: 1,
          }}>HUM.</div>
          <span style={{ font: "500 10px var(--font-mono)", color: "var(--fg-3)" }}>{time}</span>
        </div>
      )}
      <div style={{
        maxWidth: "92%",
        padding: "10px 14px",
        borderRadius: 12,
        background: isHum ? "var(--surface)" : "var(--inv-bg)",
        color: isHum ? "var(--fg-1)" : "var(--inv-fg)",
        border: isHum ? "1px solid var(--border)" : "none",
        font: "400 13px/1.55 var(--font-sans)",
        letterSpacing: "-0.005em",
        textWrap: "pretty",
      }}>{children}</div>
      {sources && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 4 }}>
          {sources.map(s => (
            <span key={s} style={{
              font: "500 11px var(--font-mono)", color: "var(--fg-3)",
              background: "var(--surface)", border: "1px solid var(--border)",
              padding: "2px 7px", borderRadius: 999,
            }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const Suggestion = ({ label, onClick }) => (
  <button onClick={onClick} style={{
    border: "1px solid var(--border)", background: "var(--surface)",
    padding: "8px 12px", borderRadius: 999, cursor: "pointer",
    font: "500 12px var(--font-sans)", color: "var(--fg-2)",
    textAlign: "left",
  }}>{label}</button>
);

const HumPanel = ({ onClose, presetQuestion }) => {
  const [msgs, setMsgs] = React.useState([
    { from: "hum", text: "Morning. Market opened quiet, three of your tokens drifted overnight. Want a brief?", time: "08:02 UTC" },
  ]);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (presetQuestion && presetQuestion.text) {
      send(presetQuestion.text);
    }
    // eslint-disable-next-line
  }, [presetQuestion]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, thinking]);

  const send = (text) => {
    if (!text || !text.trim()) return;
    setMsgs(m => [...m, { from: "you", text }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const key = text.toLowerCase().includes("pepe") ? "pepe"
                : text.toLowerCase().includes("sol") ? "sol"
                : "default";
      const reply = SAMPLE_REPLIES[key];
      setMsgs(m => [...m, { from: "hum", text: reply.text, sources: reply.sources, time: "now" }]);
      setThinking(false);
    }, 900);
  };

  return (
    <aside style={{
      width: 380, height: "100%", flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          background: "var(--inv-bg)", color: "var(--inv-fg)",
          fontFamily: "var(--font-display)", fontSize: 14, padding: "4px 8px 2px",
          lineHeight: 1,
        }}>HUM.</div>
        <div style={{ flex: 1, lineHeight: 1.2 }}>
          <div style={{ font: "600 13px var(--font-sans)" }}>Research assistant</div>
          <div style={{ font: "500 11px var(--font-mono)", color: "var(--fg-3)" }}>reads X · reads chain · doesn't sleep</div>
        </div>
        <Icon name="close" size={16} style={{ color: "var(--fg-3)", cursor: "pointer" }} onClick={onClose} />
      </div>

      {/* Conversation */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, padding: 16, overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 14,
      }}>
        {msgs.map((m, i) => (
          <HumBubble key={i} from={m.from} sources={m.sources} time={m.time}>{m.text}</HumBubble>
        ))}
        {thinking && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              background: "var(--inv-bg)", color: "var(--inv-fg)",
              fontFamily: "var(--font-display)", fontSize: 11, padding: "3px 7px 2px",
              lineHeight: 1,
            }}>HUM.</div>
            <div style={{ display: "flex", gap: 3 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "var(--fg-3)",
                  animation: `tb-dot 1.2s ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {msgs.length <= 2 && !thinking && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          <Eyebrow style={{ marginBottom: 4 }}>Try</Eyebrow>
          <Suggestion label="What's driving $PEPE buzz tonight?" onClick={() => send("What's driving $PEPE buzz?")} />
          <Suggestion label="Is the $SOL chatter actually bearish?" onClick={() => send("Is $SOL chatter bearish?")} />
          <Suggestion label="Surface new narratives my watchlist missed" onClick={() => send("Find new narratives I'm missing")} />
        </div>
      )}

      {/* Composer */}
      <div style={{ padding: 14, borderTop: "1px solid var(--border)" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 8,
          padding: "10px 12px",
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about a ticker, a handle, a narrative..."
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", fontFamily: "var(--font-sans)",
              fontSize: 13, lineHeight: 1.5, color: "var(--fg-1)",
              maxHeight: 100,
            }}
          />
          <button onClick={() => send(input)} style={{
            background: input.trim() ? "var(--buzz-500)" : "var(--ink-300)",
            color: "#fff", border: "none", borderRadius: 6,
            width: 28, height: 28, display: "grid", placeItems: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Icon name="send" size={14} />
          </button>
        </div>
        <div style={{ font: "500 10px var(--font-mono)", color: "var(--fg-3)", marginTop: 8, textAlign: "center", letterSpacing: 0 }}>
          Hum cites every source. Always verify before you trade.
        </div>
      </div>
    </aside>
  );
};

window.TBHum = { HumPanel };
