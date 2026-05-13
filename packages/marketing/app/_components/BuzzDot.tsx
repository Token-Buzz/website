interface BuzzDotProps {
  size?: number
}

export default function BuzzDot({ size = 10 }: BuzzDotProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--buzz-500)',
        display: 'inline-block',
        flexShrink: 0,
        animation: 'tb-pulse 1.8s cubic-bezier(0.3, 1.4, 0.4, 1) infinite',
      }}
    />
  )
}
