import { Skeleton } from '../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width={180} height={24} />
        <Skeleton width={260} height={14} />
      </div>

      {/* Table rows */}
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
          <Skeleton width={24} height={24} radius="var(--r-2)" />
          <Skeleton width={140} height={14} />
          <div style={{ flex: 1 }} />
          <Skeleton width={60} height={12} />
          <Skeleton width={60} height={12} />
          <Skeleton width={60} height={12} />
        </div>
      ))}
    </div>
  )
}
