import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    narratives: [
      { title: 'AI agents are back',        mentions: 4820, growth: 312, tokens: ['FET','AGIX','TAO','VIRTUAL'], handles: 42, summary: 'Three macro accounts pivoted to AI agent talk after the Anthropic release.' },
      { title: 'L2 fees discourse round 9', mentions: 3140, growth:  86, tokens: ['ARB','OP','BASE'],            handles: 28, summary: 'Sentiment turning bearish on L2s. Watch for capital rotation back to L1.' },
      { title: 'Memecoin rotation stalling',mentions: 8900, growth: -22, tokens: ['PEPE','WIF','BONK'],          handles: 64, summary: 'Big handles quiet. Only PEPE and MOG actively accumulating mindshare.' },
      { title: 'Restaking exhaustion',      mentions: 2240, growth: -14, tokens: ['EIGEN','ETHFI'],              handles: 19, summary: "Narrative cooling. Mentions down across the cohort." },
    ],
  })
}
