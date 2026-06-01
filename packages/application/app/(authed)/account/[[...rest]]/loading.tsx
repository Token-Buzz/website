import { Skeleton, SkeletonText } from '../../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <Skeleton width={160} height={24} />
      </div>

      {/* Profile card */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-3)',
          background: 'var(--bg-elevated)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Skeleton width={64} height={64} radius={999} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width={140} height={16} />
            <Skeleton width={200} height={13} />
          </div>
        </div>

        {/* Detail rows */}
        <SkeletonText lines={4} lastLineWidth="70%" gap={14} />
      </div>
    </div>
  )
}
