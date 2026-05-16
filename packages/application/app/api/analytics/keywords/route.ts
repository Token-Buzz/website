import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    items: [
      { keyword: 'accumulate', mentions: 4820, growth: 312, tokens: ['PEPE','MOG'] },
      { keyword: 'whale',      mentions: 3140, growth:  86, tokens: ['MOG','WIF'] },
      { keyword: 'rotation',   mentions: 2900, growth: -22, tokens: ['PEPE','BONK','WIF'] },
      { keyword: 'AI agent',   mentions: 2240, growth: 214, tokens: ['FET','AGIX','VIRTUAL'] },
      { keyword: 'restaking',  mentions: 1820, growth: -14, tokens: ['EIGEN','ETHFI'] },
    ],
  })
}
