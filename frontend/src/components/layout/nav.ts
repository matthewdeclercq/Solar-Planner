/**
 * Navigation component
 * Alpine.js component for navigation bar
 */

import Alpine from 'alpinejs';

export function navComponent() {
  return {
    menuOpen: false,

    toggleMenu() {
      this.menuOpen = !this.menuOpen;
    },

    toggleTheme() {
      const uiStore = Alpine.store('ui') as { toggleTheme?: () => void };
      if (uiStore?.toggleTheme) {
        uiStore.toggleTheme();
      }
    },

    get theme() {
      const uiStore = Alpine.store('ui') as { theme?: string };
      return uiStore?.theme || 'dark';
    },
  };
}
