import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    items: [
      { handle: '@cobie',        followers: 812000, mentions: 48, sent: 'bull' },
      { handle: '@hsaka',        followers: 210000, mentions: 31, sent: 'bull' },
      { handle: '@CryptoKaleo',  followers: 1200000, mentions: 28, sent: 'neu' },
      { handle: '@aeyakovenko',  followers: 440000, mentions: 22, sent: 'neu' },
      { handle: '@degenspartan', followers: 320000, mentions: 19, sent: 'bear' },
      { handle: '@hosseeb',      followers: 168000, mentions: 16, sent: 'bull' },
      { handle: '@gainzy222',    followers:  98000, mentions: 14, sent: 'bull' },
    ],
  })
}
