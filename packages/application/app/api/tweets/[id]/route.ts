import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  return NextResponse.json({
    id,
    handle: '@cobie',
    followers: 812000,
    time: new Date().toISOString(),
    sent: 'bull',
    text: 'watching $PEPE accumulate again.',
    tick: 'PEPE',
    engagement: { likes: 1240, retweets: 380, replies: 142 },
  })
}
