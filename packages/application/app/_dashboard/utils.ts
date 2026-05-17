// Format numbers: 2140000 → "2.1M", 48900 → "48.9k", 412 → "412"
export function fmtCount(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(Math.round(n));
}

// Format delta percentage: 18.4 → "+18.4%", -5 → "-5%"
export function fmtDelta(n: number, raw = false): string {
  const sign = n > 0 ? "+" : "";
  const formatted = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
  return raw ? sign + formatted : sign + formatted + "%";
}

// Get hour bucket from ISO string: "2025-05-16T09:14" → "09:00"
export function bucketToTime(bucket: string): string {
  // bucket format: "2025-05-16T09:14" or similar
  const parts = bucket.split("T");
  if (parts.length === 2) {
    const timeParts = parts[1].split(":");
    if (timeParts.length >= 2) {
      return `${timeParts[0]}:00`;
    }
  }
  return bucket;
}
