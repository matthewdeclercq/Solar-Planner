/**
 * UI store
 * Manages UI state (theme, loading, errors, showResults)
 */

import Alpine from 'alpinejs';
import type { Theme } from '../types/store';

export interface UIStore {
  [key: string]: unknown;
  theme: Theme;
  isLoading: boolean;
  error: string | null;
  showResults: boolean;
  setTheme(newTheme: Theme): void;
  toggleTheme(): void;
  setLoading(loading: boolean): void;
  setError(error: string | null): void;
  setShowResults(show: boolean): void;
}

/**
 * Initialize the UI store
 */
export function initUIStore(): void {
  // Get theme from localStorage
  const storedTheme = localStorage.getItem('solar-planner-theme');
  const theme: Theme = storedTheme === 'light' ? 'light' : 'dark';

  Alpine.store('ui', {
    theme,
    isLoading: false,
    error: null as string | null,
    showResults: false,

    setTheme(newTheme: Theme): void {
      this.theme = newTheme;
      localStorage.setItem('solar-planner-theme', newTheme);
      const root = document.documentElement;
      if (newTheme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }
    },

    toggleTheme(): void {
      const newTheme: Theme = this.theme === 'light' ? 'dark' : 'light';
      this.setTheme(newTheme);
    },

    setLoading(loading: boolean): void {
      this.isLoading = loading;
    },

    setError(error: string | null): void {
      this.error = error;
    },

    setShowResults(show: boolean): void {
      this.showResults = show;
    },
  } as UIStore);
}
