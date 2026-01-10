/**
 * Math utilities
 */

export function avg<T>(arr: T[], key: keyof T): number {
  if (!arr || arr.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const item of arr) {
    const val = item[key];
    if (val != null && typeof val === 'number' && !isNaN(val)) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

export function round(num: number | null | undefined, decimals = 1): number {
  if (num == null || isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}
