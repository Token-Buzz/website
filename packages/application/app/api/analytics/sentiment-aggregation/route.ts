import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    global: { score: 12, delta: 9.2 },
    tokens: [
      { sym: 'PEPE',  mentions: 48900, score:  62, d: 18 },
      { sym: 'SOL',   mentions: 12400, score: -42, d: -8 },
      { sym: 'BONK',  mentions: 22700, score:   4, d: -2 },
      { sym: 'WIF',   mentions:  9800, score:  48, d: 12 },
      { sym: 'DOGE',  mentions: 18900, score:   8, d:  1 },
      { sym: 'MOG',   mentions:  6700, score:  78, d: 44 },
      { sym: 'TURBO', mentions:  3100, score:  56, d: 22 },
      { sym: 'BRETT', mentions:  4400, score:  -8, d: -6 },
      { sym: 'ETH',   mentions: 31200, score:  12, d:  4 },
      { sym: 'JUP',   mentions:  7800, score: -22, d: -10 },
      { sym: 'TIA',   mentions:  5200, score: -36, d: -18 },
      { sym: 'ARB',   mentions:  6100, score:  -4, d: -3 },
    ],
  })
}
