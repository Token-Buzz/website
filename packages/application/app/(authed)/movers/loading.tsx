import { Skeleton } from '../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={140} height={24} />
        <Skeleton width={220} height={14} />
      </div>

      {/* Mover rows: rank/symbol + sparkline block + % figure */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {/* Rank badge */}
          <Skeleton width={24} height={24} radius="var(--r-2)" />
          {/* Symbol + name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 120 }}>
            <Skeleton width={80} height={14} />
            <Skeleton width={110} height={11} />
          </div>
          <div style={{ flex: 1 }} />
          {/* Sparkline placeholder */}
          <Skeleton width={100} height={28} radius="var(--r-2)" />
          {/* % change */}
          <Skeleton width={56} height={14} />
        </div>
      ))}
    </div>
  )
}
