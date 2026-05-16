import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    items: [
      { domain: 'twitter.com',   mentions: 142000, share: 66 },
      { domain: 'discord.com',   mentions:  28000, share: 13 },
      { domain: 'telegram.org',  mentions:  18000, share:  8 },
      { domain: 'reddit.com',    mentions:  12000, share:  6 },
      { domain: 'dexscreener.com', mentions: 8000, share:  4 },
      { domain: 'other',         mentions:   7000, share:  3 },
    ],
  })
}
