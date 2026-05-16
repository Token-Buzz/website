import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    count: 49,
    symbols: ['PEPE','MOG','SOL','BONK','WIF','BRETT','TURBO','DOGE','ETH','ARB','JUP','TIA','FET','AGIX','TAO','VIRTUAL','EIGEN','ETHFI','OP','BASE','RENDER','HNT','INJ','TRX','BTC'],
  })
}
