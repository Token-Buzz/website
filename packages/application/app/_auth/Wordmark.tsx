type WordmarkSize = 'sm' | 'md' | 'lg'

const sizeMap: Record<WordmarkSize, { padX: number; padY: number; fs: number }> = {
  sm: { padX: 10, padY: 5,  fs: 13 },
  md: { padX: 14, padY: 7,  fs: 16 },
  lg: { padX: 18, padY: 10, fs: 22 },
}

export function Wordmark({ size = 'md' }: { size?: WordmarkSize }) {
  const { padX, padY, fs } = sizeMap[size]
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        background: 'var(--inv-bg)',
        color: 'var(--inv-fg)',
        padding: `${padY}px ${padX}px`,
        borderRadius: 2,
        fontFamily: 'var(--font-display)',
        fontSize: fs,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        lineHeight: 1,
        display: 'inline-block',
      }}>
        TOKENBUZZ
      </span>
    </div>
  )
}
