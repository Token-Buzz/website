import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { symbol } = await params
  return NextResponse.json({
    symbol: symbol.toUpperCase(),
    mentions: [
      { handle: '@cobie',   followers: '812k', time: '2m',  sent: 'bull', text: `watching $${symbol.toUpperCase()} accumulate again.` },
      { handle: '@hsaka',   followers: '210k', time: '14m', sent: 'bull', text: `$${symbol.toUpperCase()} setup looks clean.` },
    ],
  })
}
