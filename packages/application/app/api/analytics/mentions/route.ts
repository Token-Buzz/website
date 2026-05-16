import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    items: [
      { handle: '@cobie',        followers: '812k', mentions: 48, engagement: 9.2 },
      { handle: '@hsaka',        followers: '210k', mentions: 31, engagement: 7.4 },
      { handle: '@CryptoKaleo',  followers: '1.2M', mentions: 28, engagement: 11.3 },
      { handle: '@aeyakovenko',  followers: '440k', mentions: 22, engagement: 6.8 },
      { handle: '@degenspartan', followers: '320k', mentions: 19, engagement: 8.1 },
      { handle: '@hosseeb',      followers: '168k', mentions: 16, engagement: 5.9 },
      { handle: '@gainzy222',    followers: '98k',  mentions: 14, engagement: 12.4 },
    ],
  })
}
