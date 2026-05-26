const SWATCH_COLORS = [
  'var(--buzz-500)', '#6E5BA3', '#2E7F7B', '#B8527E', '#C68A2E', '#3B7DD8',
] as const

export function swatchForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return SWATCH_COLORS[h % SWATCH_COLORS.length]
}
