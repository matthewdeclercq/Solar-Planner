/**
 * Store initialization
 * Initializes all Alpine.js stores
 */

import { initAuthStore } from './authStore';
import { initUIStore } from './uiStore';
import { initDataStore } from './dataStore';
import { initPowerGenStore } from './powerGenStore';

/**
 * Initialize all stores
 */
export function initStores(): void {
  initAuthStore();
  initUIStore();
  initDataStore();
  initPowerGenStore();
}
