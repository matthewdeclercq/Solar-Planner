/**
 * Theme management module
 * Handles light/dark theme switching and persistence
 */

const THEME_STORAGE_KEY = 'solar-planner-theme';
const DEFAULT_THEME = 'dark';

/**
 * Get current theme from localStorage or return default
 * @returns {string} Current theme ('light' or 'dark')
 */
export function getCurrentTheme() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_THEME;
  }
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : DEFAULT_THEME;
}

/**
 * Set theme on document root
 * @param {string} theme - Theme to set ('light' or 'dark')
 */
function setTheme(theme) {
  const root = document.documentElement;
  
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
  
  // Save to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}

/**
 * Initialize theme on page load
 * Should be called early in app initialization
 */
export function initTheme() {
  const theme = getCurrentTheme();
  setTheme(theme);
}

/**
 * Toggle between light and dark themes
 * @returns {string} New theme after toggle
 */
export function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  return newTheme;
}
