import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    decay: [100, 82, 67, 54, 44, 36, 29, 24, 20, 16, 13, 11, 9, 7, 6, 5, 4, 3, 3, 2, 2, 1, 1, 1],
    windowHours: 24,
  })
}
