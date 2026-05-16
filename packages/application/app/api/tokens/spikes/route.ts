import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    spikes: [
      { sym: 'MOG',   name: 'Mog Coin',  dbuzz: 4180, mentions: 6700,  sent: 'bull', spark: [3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true,  summary: 'Three previously dormant whales retweeted into MOG within 14 minutes.' },
      { sym: 'PEPE',  name: 'Pepe',      dbuzz:  412, mentions: 48900, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true,  summary: 'Accumulation talk from six mid-tier handles. Coinbase Pro volume cleanest since May.' },
      { sym: 'TURBO', name: 'Turbo',     dbuzz:   96, mentions: 3100,  sent: 'bull', spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true, summary: 'Discord chatter spike from three trader cohorts. Quiet on X — yet.' },
      { sym: 'WIF',   name: 'dogwifhat', dbuzz:   84, mentions: 9800,  sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16], live: false, summary: 'Steady climb. No single catalyst — just broad-based mention growth.' },
    ],
  })
}
