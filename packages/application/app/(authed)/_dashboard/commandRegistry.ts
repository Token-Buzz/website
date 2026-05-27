export function pickById<T extends { id: string }>(items: T[], ids: string[]): T[] {
  return ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => item != null)
}
