import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const handle = searchParams.get('handle') ?? '@cobie'
  const snapshots = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    followers: 810000 + i * 800 + Math.round(Math.random() * 1000),
  }))
  return NextResponse.json({ handle, snapshots })
}
