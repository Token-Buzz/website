import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    tweets: [
      { handle: '@cobie',       followers: '812k', time: '2m',  sent: 'bull', text: 'watching $PEPE accumulate again. four wallets I tagged in march are buying. not advice, just pattern.', tick: 'PEPE' },
      { handle: '@hsaka',       followers: '210k', time: '4m',  sent: 'bull', text: "$MOG volume profile is the cleanest setup I've seen since the last cycle. fwiw.", tick: 'MOG' },
      { handle: '@aeyakovenko', followers: '440k', time: '9m',  sent: 'neu',  text: 'fees on solana for memecoin wrappers spiking again. interesting.', tick: 'SOL' },
      { handle: '@CryptoKaleo', followers: '1.2M', time: '11m', sent: 'neu',  text: 'memecoin rotation feels stalled. $PEPE getting all the mindshare but the others are quiet.', tick: 'PEPE' },
      { handle: '@degenspartan',followers: '320k', time: '16m', sent: 'bear', text: 'every degen is long $PEPE rn. someone has to be wrong.', tick: 'PEPE' },
      { handle: '@hosseeb',     followers: '168k', time: '22m', sent: 'bull', text: '$MOG is one of those names where the buyers are louder than the chart suggests.', tick: 'MOG' },
      { handle: '@gainzy222',   followers: '98k',  time: '28m', sent: 'bull', text: 'i still think $PEPE 2x from here before the cycle ends', tick: 'PEPE' },
    ],
  })
}
