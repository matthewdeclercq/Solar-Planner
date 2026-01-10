/**
 * Cache utilities
 */

export function normalizeCacheKey(location: string): string {
  return `location:${location.toLowerCase().replace(/\s+/g, '_')}`;
}

export function looksLikeCoordinates(str: string): boolean {
  if (!str) return false;
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(str.trim());
}
