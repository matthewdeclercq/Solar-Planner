/**
 * Cache management module
 */

import { CACHE_CLEAR_URL, isLocalDev } from './config.js';
import { clearCacheBtn, cacheInfoEl, cacheInfoText } from './dom.js';
import { getAuthToken, getAuthHeaders, clearAuth, handleAuthError } from './auth.js';
import { handleApiResponse, fetchCachedLocations } from './api.js';
import { showError } from './ui.js';
import { setCachedLocations } from './autocomplete.js';

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
    const originalText = clearCacheBtn.textContent;
    clearCacheBtn.textContent = 'Clearing...';
    
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
      cacheInfoText.textContent = `✓ ${message}`;
      cacheInfoEl.classList.add('cached');
      clearCacheBtn.classList.remove('show');

      // Refresh cached locations list
      fetchCachedLocations().then(setCachedLocations);

      // Reset button after a moment
      setTimeout(() => {
        clearCacheBtn.textContent = originalText;
        clearCacheBtn.disabled = false;
      }, 2000);
      
    } catch (error) {
      showError(error.message || 'Failed to clear cache');
      clearCacheBtn.textContent = originalText;
      clearCacheBtn.disabled = false;
      if (isLocalDev) {
        console.error('Clear cache error:', error);
      }
    }
  });
}

