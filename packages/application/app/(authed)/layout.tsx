import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { AppShell } from './_dashboard/Shell'

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  return <AppShell>{children}</AppShell>
}
