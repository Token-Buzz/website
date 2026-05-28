import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import { getSavedQuery } from '@monorepo-template/core/db/saved-queries'
import { decodeQueryId } from '@monorepo-template/core/lib/queryId'
import type { SummaryData } from '../../_analytics/SummaryProvider'
import { SnapshotView } from '../../_history/SnapshotView'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ queryId: string }>
}) {
  const { queryId } = await params
  const decoded = decodeQueryId(decodeURIComponent(queryId))
  return {
    title: decoded ? `Snapshot · TokenBuzz` : 'Not Found · TokenBuzz',
  }
}

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ queryId: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { queryId } = await params
  const decoded = decodeQueryId(decodeURIComponent(queryId))
  if (!decoded) notFound()

  const { submittedAt, queryHash } = decoded
  const saved = await getSavedQuery(userId, submittedAt, queryHash)
  if (!saved) notFound()

  return (
    <SnapshotView
      query={saved.query}
      submittedAt={saved.submittedAt}
      queryHash={saved.queryHash}
      snapshot={saved.snapshot as SummaryData}
    />
  )
}
