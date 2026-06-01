import BuzzDot from './BuzzDot'
import Button from './Button'

export default function CTA() {
  return (
    <section style={{ padding: '0 32px 96px' }}>
      <div
        className="cta-grid"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          background: 'var(--data-bg)',
          color: 'var(--data-fg)',
          borderRadius: 20,
          padding: '80px 56px',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: 48,
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Live badge */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            right: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            font: '600 10px var(--font-sans)',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--data-amber)',
          }}
        >
          <BuzzDot size={7} /> Live
        </div>

        {/* Left: copy + CTAs */}
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 5vw, 64px)',
              lineHeight: 1.05,
              letterSpacing: '0.005em',
              textTransform: 'uppercase',
              color: 'var(--data-fg)',
              marginBottom: 18,
            }}
          >
            Stop staring.<br />Start listening.
          </div>
          <div
            style={{
              font: '400 17px/1.55 var(--font-sans)',
              color: 'var(--data-dim)',
              maxWidth: 520,
              marginBottom: 28,
            }}
          >
            Five tracked tokens, free, forever. Upgrade if you want the live feed and Hum.
            Cancel in one click.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" iconRight="arrowR" href="#pricing">
              Get started — it&apos;s free
            </Button>
            <Button
              variant="ghost"
              size="lg"
              href="/changelog"
              style={{ color: 'var(--data-fg)', borderColor: 'var(--data-line)' }}
            >
              Read the changelog
            </Button>
          </div>
        </div>

        {/* Right: terminal data block */}
        <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.35)',
              color: 'var(--data-fg)',
              fontFamily: 'var(--font-mono)',
              padding: '20px 22px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.7,
              border: '1px solid var(--data-line)',
            }}
          >
            <div style={{ color: 'var(--data-dim)', marginBottom: 8 }}># Last hour, $PEPE</div>
            <div>
              <span style={{ color: 'var(--data-amber)' }}>buzz</span>
              {'     '}
              <span style={{ color: 'var(--data-pos)' }}>+412%</span>
            </div>
            <div>
              <span style={{ color: 'var(--data-amber)' }}>mentions</span>
              {' '}48.9k{' '}
              <span style={{ color: 'var(--data-dim)' }}>(+38 new handles)</span>
            </div>
            <div>
              <span style={{ color: 'var(--data-amber)' }}>sent</span>
              {'     '}
              <span style={{ color: 'var(--data-pos)' }}>+62</span> bullish
            </div>
            <div>
              <span style={{ color: 'var(--data-amber)' }}>price</span>
              {'    '}$0.0000182{' '}
              <span style={{ color: 'var(--data-pos)' }}>+24.1%</span>
            </div>
            <div style={{ marginTop: 12, color: 'var(--data-dim)' }}>
              # the chart still hasn&apos;t moved.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
