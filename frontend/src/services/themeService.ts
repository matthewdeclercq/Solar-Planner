/**
 * Theme service
 * Handles theme initialization and management
 */

import type { Theme } from '../types/store';

const THEME_STORAGE_KEY = 'solar-planner-theme';
const DEFAULT_THEME: Theme = 'dark';

/**
 * Get current theme from localStorage or return default
 */
export function getCurrentTheme(): Theme {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_THEME;
  }

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : DEFAULT_THEME;
}

/**
 * Initialize theme on page load
 * Should be called early in app initialization
 */
export function initTheme(): void {
  const theme = getCurrentTheme();
  const root = document.documentElement;

  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
}
