/**
 * Authentication module
 */

import { TOKEN_STORAGE_KEY, TOKEN_EXPIRY_KEY } from './config.js';
import { showError } from './ui.js';

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!token || !expiry) {
    return false;
  }
  
  // Check if token has expired
  const expiresAt = parseInt(expiry, 10);
  if (Date.now() >= expiresAt) {
    // Token expired, clear it
    clearAuth();
    return false;
  }
  
  return true;
}

/**
 * Get authentication token
 * @returns {string|null}
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

/**
 * Get authorization headers for API requests
 * @param {string|null} token - Optional token (uses stored token if not provided)
 * @returns {Object} Headers object
 */
export function getAuthHeaders(token = null) {
  const authToken = token || getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
  };
}

/**
 * Clear authentication
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Handle authentication errors (401)
 */
export function handleAuthError() {
  clearAuth();
  showError('Session expired. Please login again.');
  setTimeout(() => window.location.reload(), 2000);
}

