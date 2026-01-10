/**
 * Input validation utilities
 */

const MAX_LOCATION_LENGTH = 500;
const MIN_LAT = -90;
const MAX_LAT = 90;
const MIN_LON = -180;
const MAX_LON = 180;

/**
 * Validate and sanitize location string
 */
function validateAndSanitizeLocation(location: string | undefined): string {
  if (!location) {
    throw new Error('Location is required');
  }

  const trimmed = location.trim();
  
  if (!trimmed) {
    throw new Error('Location cannot be empty or whitespace only');
  }

  if (trimmed.length > MAX_LOCATION_LENGTH) {
    throw new Error(`Location must be ${MAX_LOCATION_LENGTH} characters or less`);
  }

  // Sanitize for use in URLs and cache keys
  // Remove control characters and other potentially dangerous characters
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  
  if (!sanitized) {
    throw new Error('Location contains only invalid characters');
  }

  return sanitized;
}

/**
 * Validate latitude value
 */
function validateLatitude(lat: unknown): number {
  if (typeof lat !== 'number') {
    throw new Error('Latitude must be a number');
  }

  if (isNaN(lat) || !isFinite(lat)) {
    throw new Error('Latitude must be a valid finite number');
  }

  if (lat < MIN_LAT || lat > MAX_LAT) {
    throw new Error(`Latitude must be between ${MIN_LAT} and ${MAX_LAT}`);
  }

  return lat;
}

/**
 * Validate longitude value
 */
function validateLongitude(lon: unknown): number {
  if (typeof lon !== 'number') {
    throw new Error('Longitude must be a number');
  }

  if (isNaN(lon) || !isFinite(lon)) {
    throw new Error('Longitude must be a valid finite number');
  }

  if (lon < MIN_LON || lon > MAX_LON) {
    throw new Error(`Longitude must be between ${MIN_LON} and ${MAX_LON}`);
  }

  return lon;
}

/**
 * Parse and validate location request
 */
export function parseLocationRequest(body: unknown): { location: string; apiLocation: string } {
  const req = body as { location?: string; lat?: number; lon?: number };
  
  const location = validateAndSanitizeLocation(req?.location);

  // If lat/lon are provided, validate them and use coordinates as apiLocation
  if (req.lat != null && req.lon != null) {
    const lat = validateLatitude(req.lat);
    const lon = validateLongitude(req.lon);
    const apiLocation = `${lat},${lon}`;
    return { location, apiLocation };
  }

  // Otherwise use the location string as apiLocation
  return { location, apiLocation: location };
}
