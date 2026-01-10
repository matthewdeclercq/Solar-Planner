/**
 * Authentication service
 * Handles authentication state and token management
 */

import { TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY } from './configService';
import { toggleAppView } from '@/main';
import Alpine from 'alpinejs';

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) {
    return false;
  }

  const expiresAt = parseInt(expiry, 10);
  if (Date.now() >= expiresAt) {
    clearAuth();
    return false;
  }

  return true;
}

/**
 * Get authentication token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Get authorization headers for API requests
 */
export function getAuthHeaders(token: string | null = null): Record<string, string> {
  const authToken = token || getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

/**
 * Clear authentication
 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);

  // Update auth store if available
  const authStore = Alpine.store('auth') as { clearAuth?: () => void };
  if (authStore?.clearAuth) {
    authStore.clearAuth();
  }
}

/**
 * Handle authentication errors (401)
 */
export function handleAuthError(): void {
  clearAuth();

  // Update UI store error
  const uiStore = Alpine.store('ui') as { setError?: (error: string) => void };
  if (uiStore?.setError) {
    uiStore.setError('Session expired. Please login again.');
  }

  // Toggle to login page without page reload
  setTimeout(() => toggleAppView(), 2000);
}
