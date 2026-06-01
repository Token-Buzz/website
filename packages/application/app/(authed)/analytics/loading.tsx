import { Skeleton, SkeletonCard } from '../_dashboard/Skeleton'

export default function Loading() {
  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1480,
        margin: '0 auto',
      }}
    >
      {/* Eyebrow + title */}
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton width={90} height={12} />
        <Skeleton width={220} height={28} />
      </div>

      {/* Search bar */}
      <Skeleton height={44} radius="var(--r-3)" style={{ marginBottom: 24 }} />

      {/* Chart grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} bodyHeight={200} />
        ))}
      </div>
    </div>
  )
}
