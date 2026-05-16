import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    window: '1H',
    series: [84,86,88,85,90,92,88,94,99,102,106,110,118,122,130,142,156,168,174,182,190,188,192,198,204,212,218,224,226,232,238,244,250,256,252,248,244,252,264,272,280,288,298,304,312,308,314,322,328,336,342,348,354,358,362,366,370,376,382,388],
  })
}
