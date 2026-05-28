import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { listSavedQueries } from '@monorepo-template/core/db/saved-queries'
import { HistoryView } from '../_history/HistoryView'

export const metadata = { title: 'History · TokenBuzz' }

export default async function HistoryPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const items = await listSavedQueries(userId)

  return <HistoryView initialItems={items} />
}
