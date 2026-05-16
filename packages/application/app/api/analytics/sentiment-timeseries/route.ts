import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    series: [
      { bucket: '00', bull: 58, neu: 22, bear: 20 },
      { bucket: '02', bull: 55, neu: 24, bear: 21 },
      { bucket: '04', bull: 52, neu: 26, bear: 22 },
      { bucket: '06', bull: 57, neu: 23, bear: 20 },
      { bucket: '08', bull: 63, neu: 20, bear: 17 },
      { bucket: '10', bull: 68, neu: 18, bear: 14 },
      { bucket: '12', bull: 65, neu: 19, bear: 16 },
      { bucket: '14', bull: 61, neu: 21, bear: 18 },
      { bucket: '16', bull: 66, neu: 19, bear: 15 },
      { bucket: '18', bull: 70, neu: 17, bear: 13 },
      { bucket: '20', bull: 67, neu: 18, bear: 15 },
      { bucket: '22', bull: 62, neu: 20, bear: 18 },
    ],
  })
}
