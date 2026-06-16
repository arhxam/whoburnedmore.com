/** Small pure formatting helpers shared by the terminal report and the HTML dashboard. */

/** 1234567 -> "1.23M", 9_900 -> "9.9K", 42 -> "42". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

/** 1234.5 -> "$1,234.50". */
export function formatUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A unicode block bar of a given fraction (0..1), `width` cells wide. */
export function bar(fraction: number, width = 24): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(clamped * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Sort a Map of buckets by token count, biggest first, capped at `limit`. */
export function topBy<T extends { tokens: number }>(
  map: Map<string, T>,
  limit = 8,
): Array<[string, T]> {
  return [...map.entries()].sort((a, b) => b[1].tokens - a[1].tokens).slice(0, limit);
}
