import { currentUser } from '@clerk/nextjs/server'
import { TodayView } from '../_dashboard/TodayView'

export default async function DashboardPage() {
  const user = await currentUser()
  return <TodayView firstName={user?.firstName} />
}
