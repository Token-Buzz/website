import BuzzDot from './BuzzDot'

interface WordmarkProps {
  size?: number
  suffix?: string
}

export default function Wordmark({ size = 18, suffix = '.APP' }: WordmarkProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          background: 'var(--inv-bg)',
          color: 'var(--inv-fg)',
          fontFamily: 'var(--font-display)',
          fontSize: size,
          padding: `${size * 0.34}px ${size * 0.56}px ${size * 0.22}px`,
          lineHeight: 1,
          letterSpacing: '0.02em',
        }}
      >
        TOKENBUZZ{suffix}
      </span>
      <BuzzDot size={size * 0.36} />
    </div>
  )
}
