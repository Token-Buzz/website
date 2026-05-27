import { SNAPSHOT_PATH, type TickerSnapshot } from './tickerFormat'
import LiveTickerClient from './LiveTickerClient'

async function fetchSnapshot(): Promise<TickerSnapshot | null> {
  const domain = process.env.NEXT_PUBLIC_MARKETING_DOMAIN
  if (!domain) return null

  try {
    const url = `https://${domain}${SNAPSHOT_PATH}`
    const res = await fetch(url, { next: { revalidate: 30 } })
    if (!res.ok) return null
    const data: TickerSnapshot = await res.json()
    return data
  } catch {
    return null
  }
}

export default async function LiveTicker() {
  const initial = await fetchSnapshot()
  return <LiveTickerClient initialSnapshot={initial} />
}
