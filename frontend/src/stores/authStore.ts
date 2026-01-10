/**
 * Authentication store
 * Manages authentication state and actions
 */

import Alpine from 'alpinejs';
import { TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY } from '@services/configService';

export interface AuthStore {
  isAuthenticated: boolean;
  token: string | null;
  tokenExpiry: number | null;
  setAuthenticated(token: string, expiresAt: number): void;
  clearAuth(): void;
  [key: string]: unknown;
}

/**
 * Initialize the authentication store
 */
export function initAuthStore(): void {
  // Check authentication from localStorage
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const expiresAt = expiry ? parseInt(expiry, 10) : null;
  const isAuthenticated = token && expiresAt ? Date.now() < expiresAt : false;

  Alpine.store('auth', {
    isAuthenticated,
    token: token || null,
    tokenExpiry: expiresAt,

    setAuthenticated(token: string, expiresAt: number): void {
      this.isAuthenticated = true;
      this.token = token;
      this.tokenExpiry = expiresAt;
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
    },

    clearAuth(): void {
      this.isAuthenticated = false;
      this.token = null;
      this.tokenExpiry = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    },
  } as AuthStore);
}
