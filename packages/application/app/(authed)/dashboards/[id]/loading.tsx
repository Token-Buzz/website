import { Skeleton, SkeletonCard } from '../../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div style={{ padding: 'var(--sp-6)' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <Skeleton width={220} height={26} />
        <div style={{ flex: 1 }} />
        <Skeleton width={70} height={28} radius="var(--r-2)" />
        <Skeleton width={70} height={28} radius="var(--r-2)" />
      </div>

      {/* Widget grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} bodyHeight={160} />
        ))}
      </div>
    </div>
  )
}
