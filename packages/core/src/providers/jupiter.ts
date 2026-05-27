interface JupiterPriceResponse {
  data: Record<string, { id: string; type: string; price: string }>
}

/**
 * Fetch the current USD spot price for an SPL token mint from Jupiter Price API v3.
 * Returns null on any error (network failure, bad response, unknown mint).
 * No API key required — this endpoint is fully keyless.
 */
export async function fetchJupiterPrice(mint: string): Promise<number | null> {
  const url = `https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(mint)}`
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    return null
  }

  if (!res.ok) return null

  let json: JupiterPriceResponse
  try {
    json = (await res.json()) as JupiterPriceResponse
  } catch {
    return null
  }

  const entry = json?.data?.[mint]
  if (!entry) return null

  const price = parseFloat(entry.price)
  return Number.isFinite(price) ? price : null
}
