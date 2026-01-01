/**
 * Cache management module
 */

import { CACHE_CLEAR_URL, isLocalDev } from './config.js';
import { clearCacheBtn, cacheInfoEl } from './dom.js';
import { getAuthToken, getAuthHeaders, clearAuth, handleAuthError } from './auth.js';
import { handleApiResponse } from './api.js';
import { showError } from './ui.js';

/**
 * Setup clear cache functionality
 */
export function setupClearCache() {
  clearCacheBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear the cached data? This will force fresh data to be fetched on the next request.')) {
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      showError('Not authenticated. Please login again.');
      clearAuth();
      setTimeout(() => window.location.reload(), 2000);
      return;
    }
    
    clearCacheBtn.disabled = true;
    const originalText = clearCacheBtn.innerHTML;
    clearCacheBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Clearing...';
    
    try {
      const currentLocation = clearCacheBtn.dataset.currentLocation;
      const requestBody = currentLocation ? { location: currentLocation } : {};
      
      const response = await fetch(CACHE_CLEAR_URL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(requestBody)
      });
      
      const data = await handleApiResponse(response);
      if (!data) return; // Auth error handled
      
      if (data.error) {
        throw new Error(data.error || 'Failed to clear cache');
      }
      
      // Show success message
      const message = data.message || 'Cache cleared successfully';
      cacheInfoEl.textContent = `✓ ${message}`;
      cacheInfoEl.classList.add('cached');
      
      // Reset button after a moment
      setTimeout(() => {
        clearCacheBtn.innerHTML = originalText;
        clearCacheBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      showError(error.message || 'Failed to clear cache');
      clearCacheBtn.innerHTML = originalText;
      clearCacheBtn.disabled = false;
      if (isLocalDev) {
        console.error('Clear cache error:', error);
      }
    }
  });
}

