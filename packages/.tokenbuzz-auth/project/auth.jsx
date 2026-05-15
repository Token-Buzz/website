// TokenBuzz · Auth screens
// Sign in + Sign up, styled in the warm-terminal house style.

const { useState, useEffect, useRef, useMemo } = React;

/* ---------- Icons (inline SVG, currentColor where it makes sense) ---------- */
const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12a12 12 0 0 1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.5-5.2l-6.2-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.2-.1-2.4-.4-3.5z"/>
  </svg>
);
const GitHubIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5z"/>
  </svg>
);
const AppleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9a4.7 4.7 0 0 0-3.7-2c-1.6-.2-3 .9-3.8.9s-2-.9-3.3-.9c-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.3.8 1.4 0 2.2-1.2 3.1-2.4a10.5 10.5 0 0 0 1.4-2.9 4.5 4.5 0 0 1-2.9-3.9zM13.9 4.4c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.5-.7.8-1.3 2-1.1 3.1 1.2.1 2.3-.6 3-1.4z"/>
  </svg>
);
const EyeIcon = ({ off, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? (
      <>
        <path d="M9.9 4.2A10 10 0 0 1 12 4c5 0 9.3 3.3 11 8a14 14 0 0 1-2.7 4"/>
        <path d="M6.6 6.6A14 14 0 0 0 1 12c1.7 4.7 6 8 11 8 2 0 4-.5 5.6-1.5"/>
        <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>
        <path d="M2 2l20 20"/>
      </>
    ) : (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    )}
  </svg>
);
const ArrowIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>
  </svg>
);
const CheckIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7"/>
  </svg>
);
const SpinnerIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ animation: "tb-spin 0.9s linear infinite" }}>
    <path d="M21 12a9 9 0 1 1-6.2-8.6" opacity="0.9"/>
  </svg>
);

/* ---------- Wordmark (block lockup) ---------- */
const Wordmark = ({ size = "md" }) => {
  const px = size === "sm" ? { padX: 10, padY: 5, fs: 13 } : size === "lg" ? { padX: 18, padY: 10, fs: 22 } : { padX: 14, padY: 7, fs: 16 };
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
    }}>
      <span style={{
        background: "var(--inv-bg)", color: "var(--inv-fg)",
        padding: `${px.padY}px ${px.padX}px`, borderRadius: 2,
        fontFamily: "var(--font-display)", fontSize: px.fs, letterSpacing: "0.02em",
        textTransform: "uppercase", lineHeight: 1, display: "inline-block",
      }}>TOKENBUZZ</span>
    </div>
  );
};

/* ---------- Provider button (Google / GitHub / Apple) ---------- */
const ProviderButton = ({ provider, onClick, label }) => {
  const icons = { google: <GoogleIcon />, github: <GitHubIcon />, apple: <AppleIcon /> };
  const labels = { google: "Continue with Google", github: "Continue with GitHub", apple: "Continue with Apple" };
  return (
    <button type="button" onClick={onClick} className="tb-provider-btn">
      {icons[provider]}
      <span>{label || labels[provider]}</span>
    </button>
  );
};

/* ---------- Divider with "or" ---------- */
const OrDivider = () => (
  <div className="tb-or" aria-hidden="true">
    <span className="tb-or-line"/>
    <span className="tb-or-text">or</span>
    <span className="tb-or-line"/>
  </div>
);

/* ---------- Text field ---------- */
const TextField = ({ label, badge, type = "text", value, onChange, placeholder, autoFocus, error, onTogglePassword, passwordVisible }) => {
  const [focused, setFocused] = useState(false);
  const isPassword = type === "password" || (type === "text" && onTogglePassword);
  return (
    <div className="tb-field">
      <div className="tb-field-head">
        <label className="tb-field-label">{label}</label>
        {badge && <span className="tb-field-badge">{badge}</span>}
      </div>
      <div className={"tb-input-wrap" + (focused ? " is-focused" : "") + (error ? " is-error" : "")}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="tb-input"
          autoComplete={type === "password" ? "current-password" : type === "email" ? "email" : "off"}
          spellCheck={false}
        />
        {isPassword && (
          <button type="button" className="tb-eye" onClick={onTogglePassword} tabIndex={-1} aria-label={passwordVisible ? "Hide password" : "Show password"}>
            <EyeIcon off={passwordVisible} />
          </button>
        )}
      </div>
      {error && <div className="tb-field-error">{error}</div>}
    </div>
  );
};

/* ---------- Primary CTA "Continue" ---------- */
const ContinueButton = ({ onClick, loading, success, disabled, label = "Continue" }) => (
  <button
    type="submit"
    onClick={onClick}
    disabled={disabled || loading || success}
    className={"tb-continue" + (success ? " is-success" : "")}
  >
    {success ? (<><CheckIcon /> <span>Verified</span></>)
      : loading ? (<><SpinnerIcon /> <span>One sec…</span></>)
      : (<><span>{label}</span> <ArrowIcon /></>)}
  </button>
);

/* ---------- The auth card ---------- */
const AuthCard = ({ children }) => (
  <div className="tb-card">
    {children}
  </div>
);

/* ---------- Mode tabs ---------- */
const ModeTabs = ({ mode, setMode }) => (
  <div className="tb-tabs" role="tablist">
    <button role="tab" aria-selected={mode === "in"} className={"tb-tab" + (mode === "in" ? " is-active" : "")} onClick={() => setMode("in")}>Sign in</button>
    <button role="tab" aria-selected={mode === "up"} className={"tb-tab" + (mode === "up" ? " is-active" : "")} onClick={() => setMode("up")}>Sign up</button>
    <span className="tb-tab-indicator" style={{ transform: `translateX(${mode === "in" ? 0 : 100}%)` }}/>
  </div>
);

/* ---------- Forms ---------- */
const SignInForm = ({ tweaks, onContinue, onSwitch }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const submit = (e) => {
    e?.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); }, 900);
  };
  return (
    <form onSubmit={submit} className="tb-form">
      <header className="tb-form-head">
        <h1 className="tb-title">Sign in to TokenBuzz</h1>
        <p className="tb-subtitle">Welcome back. Pick up where you left off.</p>
      </header>

      <div className="tb-providers">
        {tweaks.providers.map(p => <ProviderButton key={p} provider={p} />)}
      </div>

      <OrDivider />

      <TextField
        label="Email address"
        badge={tweaks.lastUsed ? "Last used" : null}
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@domain.com"
        autoFocus
      />

      <ContinueButton loading={loading} success={success} disabled={!email.trim()} />

      <p className="tb-footer-link">
        Don't have an account? <button type="button" onClick={onSwitch}>Sign up</button>
      </p>
    </form>
  );
};

const SignUpForm = ({ tweaks, onContinue, onSwitch }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const strength = useMemo(() => {
    if (!password) return null;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0-4
  }, [password]);
  const submit = (e) => {
    e?.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setTimeout(() => { setLoading(false); setSuccess(true); }, 900);
  };
  return (
    <form onSubmit={submit} className="tb-form">
      <header className="tb-form-head">
        <h1 className="tb-title">Create your account</h1>
        <p className="tb-subtitle">Watchlist, alerts, and Hum — yours in 30 seconds.</p>
      </header>

      <div className="tb-providers">
        {tweaks.providers.map(p => <ProviderButton key={p} provider={p} />)}
      </div>

      <OrDivider />

      <TextField
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@domain.com"
        autoFocus
      />

      <TextField
        label="Password"
        type={showPw ? "text" : "password"}
        value={password}
        onChange={setPassword}
        placeholder="Create a password"
        onTogglePassword={() => setShowPw(s => !s)}
        passwordVisible={showPw}
      />

      {password && (
        <div className="tb-strength" aria-hidden="true">
          {[1,2,3,4].map(i => (
            <span key={i} className={"tb-strength-bar" + (i <= strength ? " is-on" : "") + " s-" + strength}/>
          ))}
          <span className="tb-strength-label">
            {strength <= 1 ? "Weak" : strength === 2 ? "Fair" : strength === 3 ? "Good" : "Strong"}
          </span>
        </div>
      )}

      <ContinueButton loading={loading} success={success} disabled={!email.trim() || !password} />

      <p className="tb-footer-link">
        Already have an account? <button type="button" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
};

/* ---------- Brand panel (unused; kept for reference) ---------- */
// eslint-disable-next-line no-unused-vars
const _BrandPanel = () => {
  // Synthetic live ticker rows
  const initialRows = [
    { t: "BTC",   v: "+2.41%", d: 1, buzz: 412, hot: false },
    { t: "PEPE",  v: "+18.7%", d: 1, buzz: 8240, hot: true },
    { t: "SOL",   v: "−1.92%", d: -1, buzz: 1604, hot: false },
    { t: "TURBO", v: "+44.2%", d: 1, buzz: 2911, hot: true },
    { t: "BONK",  v: "+7.05%", d: 1, buzz: 1180, hot: false },
    { t: "ETH",   v: "−0.34%", d: -1, buzz: 980, hot: false },
    { t: "WIF",   v: "+3.18%", d: 1, buzz: 720, hot: false },
  ];
  const [rows, setRows] = useState(initialRows);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => {
      setRows(rs => rs.map(r => {
        const delta = (Math.random() - 0.48) * 0.6;
        const cur = parseFloat(r.v);
        const nv = cur + delta;
        return { ...r, v: (nv > 0 ? "+" : "−") + Math.abs(nv).toFixed(2) + "%", d: nv >= 0 ? 1 : -1, buzz: Math.max(50, Math.round(r.buzz + (Math.random() - 0.4) * 80)) };
      }));
      setNow(new Date());
    }, 1500);
    return () => clearInterval(t);
  }, []);

  const time = now.toUTCString().slice(17, 25) + " UTC";

  // Mini sparkline points
  const spark = (seed) => Array.from({ length: 24 }, (_, i) => 50 + Math.sin(i * 0.6 + seed) * 12 + Math.cos(i * 0.3 + seed * 2) * 8);

  return (
    <aside className="tb-brand">
      <div className="tb-brand-grain"/>

      <div className="tb-brand-head">
        <Wordmark size="md" />
        <div className="tb-live">
          <span className="tb-live-dot"/> LIVE · {time}
        </div>
      </div>

      <div className="tb-brand-hero">
        <div className="tb-eyebrow">SOCIAL INTELLIGENCE · LIVE FEED</div>
        <h2 className="tb-brand-title">Hear the market before you see it.</h2>
        <p className="tb-brand-sub">Mentions, sentiment, and emerging narratives across X — surfaced the moment they form.</p>
      </div>

      <div className="tb-feed">
        <div className="tb-feed-head">
          <span>TICKER</span>
          <span>24H</span>
          <span style={{ textAlign: "right" }}>BUZZ / 1H</span>
        </div>
        {rows.map((r, i) => (
          <div key={r.t} className={"tb-feed-row" + (r.hot ? " is-hot" : "")}>
            <span className="tb-feed-ticker">${r.t}</span>
            <span className={"tb-feed-delta " + (r.d > 0 ? "is-pos" : "is-neg")}>{r.v}</span>
            <span className="tb-feed-buzz">
              <svg width="56" height="16" viewBox="0 0 56 16" preserveAspectRatio="none">
                <polyline
                  points={spark(i + r.buzz / 100).map((p, j) => `${j * (56 / 23)},${16 - (p - 30) * 0.25}`).join(" ")}
                  fill="none"
                  stroke={r.hot ? "var(--buzz-500)" : "var(--data-amber)"}
                  strokeWidth="1.2"
                />
              </svg>
              <span className="tb-feed-num">{r.buzz >= 1000 ? (r.buzz / 1000).toFixed(1) + "k" : r.buzz}</span>
              {r.hot && <span className="tb-pulse-dot"/>}
            </span>
          </div>
        ))}
      </div>

      <blockquote className="tb-quote">
        <span className="tb-quote-mark">“</span>
        Buzz is loud. The chart isn't. You decide which one is lying.
      </blockquote>
    </aside>
  );
};

/* ---------- App ---------- */
function AuthApp() {
  const [mode, setMode] = useState("in");
  const formProps = {
    tweaks: { providers: ["google"], lastUsed: true },
    onSwitch: () => setMode(mode === "in" ? "up" : "in"),
  };
  return (
    <div className="tb-stage is-center">
      <section className="tb-pane">
        <div className="tb-pane-inner">
          <div className="tb-pane-mark">
            <Wordmark size="md" />
          </div>

          <AuthCard>
            <ModeTabs mode={mode} setMode={setMode} />
            <div className="tb-card-body">
              {mode === "in"
                ? <SignInForm key="in" {...formProps} />
                : <SignUpForm key="up" {...formProps} />}
            </div>
          </AuthCard>

          <footer className="tb-pane-foot">
            <span className="tb-secured">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Secured by TokenBuzz · TLS 1.3
            </span>
            <span className="tb-foot-sep">·</span>
            <a href="#" className="tb-foot-link">Privacy</a>
            <a href="#" className="tb-foot-link">Terms</a>
          </footer>
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AuthApp />);
