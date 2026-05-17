import { Card, Eyebrow } from '../_dashboard/primitives'

export default function AlertsPage() {
  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow style={{ marginBottom: 8 }}>Alerts</Eyebrow>
        <h1 style={{ font: '600 28px/1.15 var(--font-sans)', letterSpacing: '-0.015em', color: 'var(--fg-1)', margin: 0 }}>Alert rules</h1>
      </div>
      <Card padding={40} style={{ textAlign: 'center' }}>
        <div style={{ font: '600 14px var(--font-sans)', color: 'var(--fg-2)', marginBottom: 8 }}>Alert management coming soon</div>
        <div style={{ font: '400 13px var(--font-sans)', color: 'var(--fg-3)' }}>Configure buzz spikes, sentiment flips, and whale handle alerts here.</div>
      </Card>
    </div>
  )
}
