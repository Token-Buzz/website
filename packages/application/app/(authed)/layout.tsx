import { UserButton } from '@clerk/nextjs'

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)', fontSize: '20px' }}>
          TokenBuzz
        </span>
        <UserButton />
      </header>
      <main style={{ padding: '32px 24px' }}>{children}</main>
    </div>
  )
}
