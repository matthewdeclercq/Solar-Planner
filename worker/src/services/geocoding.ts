/**
 * Geocoding service
 * Handles Nominatim API integration
 */

import { looksLikeCoordinates } from '../utils/cache';

const NOMINATIM_USER_AGENT = 'Solar-Planner/1.0';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export async function enhanceResolvedAddress(
  resolvedAddress: string,
  latitude: number,
  longitude: number
): Promise<string> {
  if (!looksLikeCoordinates(resolvedAddress)) {
    return resolvedAddress;
  }

  try {
    const nominatimUrl = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const geoResponse = await fetch(nominatimUrl, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (geoResponse.ok) {
      const geoData = await geoResponse.json() as { display_name?: string };
      if (geoData.display_name) {
        return geoData.display_name;
      }
    } else {
      console.warn('[Geocoding Warning]', {
        timestamp: new Date().toISOString(),
        message: `Nominatim reverse geocoding failed with status ${geoResponse.status}`,
        latitude,
        longitude,
        status: geoResponse.status,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[Geocoding Error]', {
      timestamp: new Date().toISOString(),
      message: errorMessage,
      stack: errorStack,
      latitude,
      longitude,
      resolvedAddress,
    });
    // Keep original if geocoding fails
  }

  return resolvedAddress;
}

export async function searchLocations(query: string): Promise<Array<{
  display: string;
  value: string;
  apiLocation: string;
  lat: number;
  lon: number;
}>> {
  if (!query || query.length < 2) {
    return [];
  }

  const AUTOCOMPLETE_LIMIT = 8;
  const nominatimUrl = `${NOMINATIM_BASE_URL}/search?` +
    `format=json&q=${encodeURIComponent(query)}&limit=${AUTOCOMPLETE_LIMIT}&addressdetails=1&extratags=1`;

  try {
    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (!response.ok) {
      console.warn('[Geocoding Warning]', {
        timestamp: new Date().toISOString(),
        message: `Nominatim search failed with status ${response.status}`,
        query,
        status: response.status,
      });
      return [];
    }

    const data = await response.json() as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: Record<string, string>;
    }>;

    return data.map(item => {
      const address = item.address || {};
      
      // Build a detailed display name
      const addressFields = [
        address.neighbourhood || address.suburb || address.hamlet || address.residential || address.quarter,
        address.city || address.town || address.village || address.municipality || address.county,
        address.county,
        address.state || address.province || address.region,
        address.country
      ];
      
      const parts: string[] = [];
      const seen = new Set<string>();
      for (const field of addressFields) {
        if (field && !seen.has(field)) {
          seen.add(field);
          parts.push(field);
        }
      }
      
      const displayName = parts.length > 0 ? parts.join(', ') : item.display_name;

      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const apiLocation = (lat && lon && !isNaN(lat) && !isNaN(lon))
        ? `${lat},${lon}`
        : item.display_name;

      return {
        display: displayName,
        value: item.display_name,
        apiLocation,
        lat,
        lon
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[Geocoding Error]', {
      timestamp: new Date().toISOString(),
      message: errorMessage,
      stack: errorStack,
      query,
    });
    
    // Return empty array to maintain API contract, but error is now logged
    return [];
  }
}
