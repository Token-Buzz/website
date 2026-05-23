import Wordmark from './Wordmark'
import Icon from './Icon'

const SOCIAL = [
  { icon: 'twitter' as const,  label: 'X' },
  { icon: 'github' as const,   label: 'GitHub' },
  { icon: 'discord' as const,  label: 'Discord' },
]

type FooterLink = { label: string; href: string }
type FooterCol  = { h: string; l: FooterLink[] }

function cs(label: string): FooterLink { return { label, href: '/coming-soon' } }

const LINK_COLS: FooterCol[] = [
  { h: 'Product',   l: [cs('Watchlist'), cs('Live feed'), cs('Ask Hum'), cs('Mobile apps')] },
  { h: 'Company',   l: [cs('About'), cs('Blog'), cs('Press'), cs('Careers'), cs('Brand')] },
  {
    h: 'Resources',
    l: [cs('Docs'), cs('Pricing'), cs('Status'), cs('Security'), { label: 'Changelog', href: '/changelog' }],
  },
  {
    h: 'Legal',
    l: [cs('Terms'), cs('Privacy'), cs('Disclosures'), { label: 'Contact', href: '/contact' }],
  },
]

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--data-bg)',
        color: 'var(--data-fg)',
        padding: '72px 32px 32px',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '2.2fr 1fr 1fr 1fr 1fr',
            gap: 48,
            marginBottom: 56,
          }}
        >
          {/* Brand column */}
          <div>
            <Wordmark size={20} suffix=".APP" />
            <div
              style={{
                font: '400 14px/1.55 var(--font-sans)',
                color: 'var(--data-dim)',
                maxWidth: 340,
                marginTop: 18,
              }}
            >
              Hear the market before you see it. Built in Brooklyn by people who got tired of
              refreshing their column.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              {SOCIAL.map(s => (
                <a
                  key={s.icon}
                  href="/coming-soon"
                  aria-label={s.label}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: '1px solid var(--data-line)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--data-fg)',
                    textDecoration: 'none',
                  }}
                >
                  <Icon name={s.icon} size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {LINK_COLS.map(col => (
            <div key={col.h}>
              <div
                style={{
                  font: '600 10px var(--font-sans)',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--data-dim)',
                  marginBottom: 14,
                }}
              >
                {col.h}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {col.l.map(item => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      style={{
                        font: '500 14px var(--font-sans)',
                        color: 'var(--data-fg)',
                        textDecoration: 'none',
                      }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '1px solid var(--data-line)',
            paddingTop: 24,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ font: '500 12px var(--font-mono)', color: 'var(--data-dim)' }}>
            © 2026 TokenBuzz Inc. · Not financial advice.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 16,
              font: '500 12px var(--font-mono)',
              color: 'var(--data-dim)',
              alignItems: 'center',
            }}
          >
            <span>v 2.4.1</span>
            <span>·</span>
            <span
              style={{
                color: 'var(--data-pos)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ● All systems normal
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
