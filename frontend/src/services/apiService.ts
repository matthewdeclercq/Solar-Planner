/**
 * API service
 * Handles all API communication
 */

import type {
  LoginRequest,
  LoginResponse,
  DataRequest,
  AutocompleteResponse,
  CacheClearRequest,
  CacheClearResponse,
  CacheListResponse,
} from '../types/api';
import type { LocationDataResponse } from '../types/data';
import {
  API_URL,
  LOGIN_URL,
  CACHE_CLEAR_URL,
  CACHE_LIST_URL,
  AUTOCOMPLETE_URL,
} from './configService';
import { getAuthToken } from './authService';
import { logger } from './loggerService';

/**
 * Parse JSON response safely
 */
async function parseJsonResponse(response: Response): Promise<unknown> {
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
 */
async function handleApiResponse<T>(response: Response): Promise<T | null> {
  if (response.status === 401) {
    // Auth error - will be handled by caller
    return null;
  }

  if (!response.ok) {
    try {
      const data = (await parseJsonResponse(response)) as { error?: string };
      throw new Error(data.error || `Request failed with status ${response.status}`);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Invalid response') || error.message.includes('Empty response'))
      ) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      throw error;
    }
  }

  return (await parseJsonResponse(response)) as T;
}

/**
 * Login with password
 */
export async function login(password: string): Promise<LoginResponse> {
  const response = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password } as LoginRequest),
  });

  const data = await handleApiResponse<LoginResponse>(response);
  if (!data) {
    throw new Error('Login failed');
  }

  return data;
}

/**
 * Fetch location data
 */
export async function fetchLocationData(
  apiLocation: string,
  lat?: number,
  lon?: number
): Promise<LocationDataResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated. Please login again.');
  }

  const requestBody: DataRequest = { location: apiLocation };
  if (lat != null && lon != null) {
    requestBody.lat = lat;
    requestBody.lon = lon;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await handleApiResponse<LocationDataResponse>(response);
  if (!data) {
    throw new Error('Authentication failed');
  }

  return data;
}

/**
 * Fetch autocomplete suggestions
 */
export async function fetchAutocomplete(query: string): Promise<AutocompleteResponse> {
  const token = getAuthToken();
  if (!token) {
    return { suggestions: [] };
  }

  try {
    const url = new URL(AUTOCOMPLETE_URL);
    url.searchParams.set('q', query);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await handleApiResponse<AutocompleteResponse>(response);
    return data || { suggestions: [] };
  } catch (error) {
    logger.error('Failed to fetch autocomplete', error);
    return { suggestions: [] };
  }
}

/**
 * Clear cache
 */
export async function clearCache(location?: string): Promise<CacheClearResponse> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const requestBody: CacheClearRequest = location ? { location } : {};
  const response = await fetch(CACHE_CLEAR_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const data = await handleApiResponse<CacheClearResponse>(response);
  if (!data) {
    throw new Error('Authentication failed');
  }

  return data;
}

/**
 * Fetch cached locations list
 */
export async function fetchCachedLocations(): Promise<CacheListResponse> {
  const token = getAuthToken();
  if (!token) {
    return { locations: [] };
  }

  try {
    const response = await fetch(CACHE_LIST_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await handleApiResponse<CacheListResponse>(response);
    return data || { locations: [] };
  } catch (error) {
    logger.error('Failed to fetch cached locations', error);
    return { locations: [] };
  }
}
