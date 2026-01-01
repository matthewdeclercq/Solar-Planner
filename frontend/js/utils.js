/**
 * Utility functions
 */

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {string|null}
 */
export function getUrlParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color (e.g., '#FF0000')
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) {
    return `rgba(0, 0, 0, ${alpha})`; // Fallback for invalid hex
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Create rgba color from hex or rgba string
 * @param {string} color - Hex or rgba color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function createRgbaColor(color, alpha) {
  if (color.startsWith('#')) {
    return hexToRgba(color, alpha);
  }
  // If already rgba, replace alpha value
  const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map(s => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  // Fallback
  return `rgba(0, 0, 0, ${alpha})`;
}

