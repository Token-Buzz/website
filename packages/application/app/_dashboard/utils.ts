export function fmtCount(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (n >= 1_000) {
    return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return String(Math.round(n));
}

export function fmtDelta(n: number, raw = false): string {
  const sign = n > 0 ? "+" : "";
  const formatted = n % 1 === 0 ? String(Math.round(n)) : n.toFixed(1);
  return raw ? sign + formatted : sign + formatted + "%";
}

export function bucketToTime(bucket: string): string {
  const parts = bucket.split("T");
  if (parts.length === 2) {
    const timeParts = parts[1].split(":");
    if (timeParts.length >= 2) {
      return `${timeParts[0]}:00`;
    }
  }
  return bucket;
}
