import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    alerts: [
      { tone: 'buzz',      time: '08:42', tag: 'BUZZ SPIKE',      target: '$MOG',      body: 'Mentions /min jumped from 14 to 218 in the last 30m. Crossed your 10× rule.' },
      { tone: 'sent',      time: '08:18', tag: 'SENTIMENT FLIP',  target: '$SOL',      body: 'Sentiment crossed −40 for the first time in 12 days.' },
      { tone: 'handle',    time: '07:51', tag: 'WHALE HANDLE',    target: '@cobie',    body: 'Just posted about $PEPE — first time in 31 days.' },
      { tone: 'narrative', time: '07:14', tag: 'NEW NARRATIVE',   target: 'AI agents', body: 'Cluster of 12 handles started co-mentioning $FET / $AGIX / $VIRTUAL inside 90 minutes.' },
    ],
  })
}
