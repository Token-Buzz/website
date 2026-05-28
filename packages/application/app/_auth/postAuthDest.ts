export function postAuthDest(token: string | null | undefined): string {
  const sym = (token ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
  return sym ? `/watchlist?focus=${encodeURIComponent(sym)}` : '/dashboard'
}
