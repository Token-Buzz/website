import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    tokens: [
      { sym: 'PEPE', name: 'Pepe',      price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
      { sym: 'SOL',  name: 'Solana',    price: 182.40,    d24: -2.31, mentions: 12400, dbuzz: -18, sent: 'bear', spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
      { sym: 'WIF',  name: 'dogwifhat', price: 2.41,      d24: 12.40, mentions:  9800, dbuzz:  84, sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16] },
    ],
    groups: [
      { id: 'g1', name: 'Memecoins', count: 12, color: '#FF6B2C' },
      { id: 'g2', name: 'L1s',       count:  6, color: '#6E5BA3' },
      { id: 'g3', name: 'DeFi',      count:  8, color: '#2E7F7B' },
    ],
  })
}
