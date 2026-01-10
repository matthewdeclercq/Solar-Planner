/**
 * Utility functions
 */

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert hex color to rgba (internal helper)
 */
function hexToRgba(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith('#') || hex.length < 7) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create rgba color from hex or rgba string
 */
export function createRgbaColor(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    return hexToRgba(color, alpha);
  }
  const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return `rgba(0, 0, 0, ${alpha})`;
}
