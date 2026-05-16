import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const TOKENS: Record<string, object> = {
  PEPE:  { sym: 'PEPE',  name: 'Pepe',      price: 0.0000182, d24: 24.10, mentions: 48900, dbuzz: 412, sent: 'bull', spark: [3,4,4,5,4,6,7,7,8,9,11,12,14,18,22], live: true },
  MOG:   { sym: 'MOG',   name: 'Mog Coin',  price: 0.00000176,d24: 41.20, mentions:  6700, dbuzz: 218, sent: 'bull', spark: [2,3,3,4,4,5,7,8,11,13,15,18,20,23,28], live: true },
  SOL:   { sym: 'SOL',   name: 'Solana',    price: 182.40,    d24: -2.31, mentions: 12400, dbuzz: -18, sent: 'bear', spark: [16,15,15,14,14,15,14,13,13,12,12,13,12,11,11] },
}

export async function GET(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { symbol } = await params
  const token = TOKENS[symbol.toUpperCase()]
  if (!token) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(token)
}
