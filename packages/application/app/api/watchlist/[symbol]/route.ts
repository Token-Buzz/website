import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { symbol } = await params
  return NextResponse.json({ added: symbol.toUpperCase() })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { symbol } = await params
  return NextResponse.json({ removed: symbol.toUpperCase() })
}
