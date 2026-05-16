import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    tokens: [
      { sym: 'PEPE',  name: 'Pepe',      price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
      { sym: 'TURBO', name: 'Turbo',     price: 0.0041,    d24:  8.07, mentions:  3100, dbuzz:  96, sent: 'bull', spark: [10,11,11,12,12,11,12,13,13,14,14,15,16,17,18], live: true },
      { sym: 'SOL',   name: 'Solana',    price: 182.40,    d24: -2.31, mentions: 12400, dbuzz: -18, sent: 'bear', spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
      { sym: 'BONK',  name: 'Bonk',      price: 0.000033,  d24: -4.62, mentions: 22700, dbuzz:   7, sent: 'neu',  spark: [12,13,12,11,12,11,11,10,11,10,10,11,10,9,10] },
      { sym: 'WIF',   name: 'dogwifhat', price: 2.41,      d24: 12.40, mentions:  9800, dbuzz:  84, sent: 'bull', spark: [8,8,9,9,10,9,10,11,10,12,12,13,14,15,16] },
      { sym: 'BRETT', name: 'Brett',     price: 0.092,     d24: -1.18, mentions:  4400, dbuzz:  22, sent: 'neu',  spark: [10,11,11,10,11,11,12,11,12,12,11,12,12,12,11] },
      { sym: 'MOG',   name: 'Mog Coin',  price: 0.00000176,d24: 41.20, mentions:  6700, dbuzz: 218, sent: 'bull', spark: [2,3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true },
      { sym: 'DOGE',  name: 'Dogecoin',  price: 0.171,     d24:  0.42, mentions: 18900, dbuzz:  -4, sent: 'neu',  spark: [12,12,11,12,12,12,11,12,12,12,11,12,12,12,12] },
    ],
  })
}
