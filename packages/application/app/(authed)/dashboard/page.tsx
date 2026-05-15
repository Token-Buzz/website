import { currentUser } from '@clerk/nextjs/server'

export default async function DashboardPage() {
  const user = await currentUser()
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-1)', marginBottom: '8px' }}>
        Hello{user?.firstName ? `, ${user.firstName}` : ''}
      </h1>
      <p style={{ color: 'var(--fg-3)' }}>Your dashboard is ready to be built.</p>
    </div>
  )
}
