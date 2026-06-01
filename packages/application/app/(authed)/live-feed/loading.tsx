import { Skeleton } from '../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={160} height={24} />
        <Skeleton width={240} height={14} />
      </div>

      {/* Feed items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Avatar */}
            <Skeleton width={32} height={32} radius={16} />
            {/* Content lines */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skeleton width="40%" height={13} />
              <Skeleton width="100%" height={13} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
