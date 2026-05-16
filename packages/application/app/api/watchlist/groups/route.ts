import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    groups: [
      { id: 'g1', name: 'Memecoins', count: 12, color: '#FF6B2C' },
      { id: 'g2', name: 'L1s',       count:  6, color: '#6E5BA3' },
      { id: 'g3', name: 'DeFi',      count:  8, color: '#2E7F7B' },
    ],
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  return NextResponse.json({ id: `g${Date.now()}`, ...body })
}
