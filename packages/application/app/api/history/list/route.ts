import { auth } from '@clerk/nextjs/server'
import { listSavedQueries } from '@monorepo-template/core/db/saved-queries'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const queries = await listSavedQueries(userId)
  return Response.json({ queries })
}
