/** "656", "12.4k", "214k", "1.2M": a count that fits a button. Same rounding as lpm Link. */
export function compactCount(n: number): string {
  if (n < 10_000) return `${n}`;
  if (n < 1_000_000) return scaledCount(n, 1_000, "k");
  return scaledCount(n, 1_000_000, "M");
}

function scaledCount(n: number, unit: number, suffix: string): string {
  const whole = Math.floor((n + unit / 2) / unit);
  if (whole >= 100) return `${whole}${suffix}`;
  const tenths = Math.floor((n * 10 + unit / 2) / unit);
  const ones = Math.floor(tenths / 10);
  return tenths % 10 === 0 ? `${ones}${suffix}` : `${ones}.${tenths % 10}${suffix}`;
}
