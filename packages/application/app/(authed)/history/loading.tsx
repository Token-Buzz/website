import { Skeleton } from '../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={160} height={24} />
        <Skeleton width={240} height={14} />
      </div>

      {/* Query rows */}
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
          <Skeleton width={200} height={14} />
          <div style={{ flex: 1 }} />
          <Skeleton width={80} height={12} />
        </div>
      ))}
    </div>
  )
}
