import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    items: [
      { tag: '#pepe',   count: 18420, pct: 100 },
      { tag: '#mog',    count: 12840, pct: 69  },
      { tag: '#solana', count:  9140, pct: 50  },
      { tag: '#crypto', count:  8720, pct: 47  },
      { tag: '#bonk',   count:  7600, pct: 41  },
      { tag: '#ai',     count:  6480, pct: 35  },
      { tag: '#defi',   count:  5240, pct: 28  },
      { tag: '#wif',    count:  4820, pct: 26  },
      { tag: '#eth',    count:  4200, pct: 23  },
      { tag: '#turbo',  count:  3640, pct: 20  },
    ],
  })
}
