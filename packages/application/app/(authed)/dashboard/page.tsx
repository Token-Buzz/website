import { currentUser } from '@clerk/nextjs/server'
import { DashboardShell } from '../../_dashboard/DashboardShell'

export default async function DashboardPage() {
  const user = await currentUser()
  return <DashboardShell firstName={user?.firstName ?? null} />
}
