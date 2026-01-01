/**
 * API communication module
 */

import { API_URL, CACHE_CLEAR_URL, isLocalDev } from './config.js';
import { getAuthToken, getAuthHeaders, handleAuthError } from './auth.js';
import { showLoading, hideLoading, showError, hideError, hideResults } from './ui.js';
import { destroyAllCharts } from './charts.js';

/**
 * Parse JSON response safely
 * Note: This consumes the response body. Check response.ok/status before calling.
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object>} Parsed JSON data
 */
export async function parseJsonResponse(response) {
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Invalid response from server. Please try again.');
  }
  
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response from server. Please try again.');
  }
  
  try {
    return JSON.parse(text);
  } catch (jsonError) {
    throw new Error('Invalid response from server. Please try again.');
  }
}

/**
 * Handle API response with proper error handling
 * @param {Response} response - Fetch response object
 * @returns {Promise<Object|null>} Parsed JSON data or null if auth error
 */
export async function handleApiResponse(response) {
  // Check status before consuming body
  if (response.status === 401) {
    handleAuthError();
    return null;
  }
  
  if (!response.ok) {
    // Try to get error message from body
    try {
      const data = await parseJsonResponse(response);
      throw new Error(data.error || `Request failed with status ${response.status}`);
    } catch (error) {
      // If parseJsonResponse failed, use generic error message
      if (error.message.includes('Invalid response') || error.message.includes('Empty response')) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      throw error;
    }
  }
  
  // Response is OK, parse JSON
  return await parseJsonResponse(response);
}

/**
 * Fetch data from the API
 * @param {string} apiLocation - API-compatible location (coordinates or address)
 */
export async function fetchData(apiLocation) {
  showLoading();
  hideError();
  hideResults();
  
  const token = getAuthToken();
  if (!token) {
    showError('Not authenticated. Please login again.');
    handleAuthError();
    return;
  }
  
  try {
    // Parse coordinates if provided in "lat,lon" format
    const locationParts = apiLocation.split(',');
    const requestBody = { location: apiLocation };
    
    // Store the original input location for cache clearing (this is what the cache key is based on)
    const cacheKeyLocation = apiLocation;
    
    // If it looks like coordinates, also send lat/lon separately for better API compatibility
    if (locationParts.length === 2) {
      const lat = parseFloat(locationParts[0].trim());
      const lon = parseFloat(locationParts[1].trim());
      if (!isNaN(lat) && !isNaN(lon)) {
        requestBody.lat = lat;
        requestBody.lon = lon;
      }
    }
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(requestBody)
    });
    
    const data = await handleApiResponse(response);
    if (!data) return; // Auth error handled
    
    if (data.error) {
      throw new Error(data.error || 'Failed to fetch data');
    }
    
    hideLoading();
    // Import displayResults dynamically to avoid circular dependency
    const { displayResults } = await import('./results.js');
    displayResults(data, cacheKeyLocation);
    
  } catch (error) {
    hideLoading();
    destroyAllCharts();
    showError(error.message || 'An error occurred. Please try again.');
    if (isLocalDev) {
      console.error('Fetch error:', error);
    }
  }
}

/**
 * Clear cache for a location
 * @param {string|null} location - Location to clear cache for (null = clear all)
 * @returns {Promise<Object>} Response data
 */
export async function clearCache(location = null) {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const requestBody = location ? { location } : {};
  const response = await fetch(CACHE_CLEAR_URL, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: JSON.stringify(requestBody)
  });
  
  return await handleApiResponse(response);
}

