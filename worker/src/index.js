/**
 * Solar Planner API - Cloudflare Worker
 * 
 * Full monthly North/South direction support added
 */

// Allowed origins for CORS (normalized - trailing slashes removed)
const ALLOWED_ORIGINS = [
  'https://solar-planner.coppertech.us',
  'https://solar-planner.coppertech.co',
  'https://solar-planner.pages.dev',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080'
].map(origin => origin.replace(/\/$/, ''));

function getCorsHeaders(origin) {
  const normalizedOrigin = origin ? origin.replace(/\/$/, '') : null;
  const isAllowed = normalizedOrigin && ALLOWED_ORIGINS.includes(normalizedOrigin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Solar declination by month (degrees) - positive when sun is north of equator
const SOLAR_DECLINATIONS = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

const DEFAULT_YEARS_OF_DATA = 2;
const DEFAULT_CACHE_TTL = 2592000; // 30 days
const TOKEN_EXPIRY_HOURS = 24;

// Conversion constants
const MJ_TO_KWH = 3.6; // 1 kWh = 3.6 MJ

// Latitude bands for solar gain calculations
const LATITUDE_BANDS = {
  EQUATORIAL: { max: 20, minGain: 1.03, maxGain: 1.15 },
  MID_LATITUDE: { max: 45, minGain: 1.05, maxGain: 1.40 },
  HIGH_LATITUDE: { max: 60, minGain: 1.15, maxGain: 1.80 },
  POLAR: { max: 90, minGain: 1.20, maxGain: 2.20 }
};

// Solar tilt calculation constants
const TILT_PENALTY_EXPONENT = 1.5;
const MAX_TILT_ANGLE = 90;
const MIN_TILT_ANGLE = 0;

// External API constants
const NOMINATIM_USER_AGENT = 'Solar-Planner/1.0';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const AUTOCOMPLETE_LIMIT = 8;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env, corsHeaders);
    }

    if (url.pathname === '/api/data' && request.method === 'POST') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response;
      return handleDataRequest(request, env, ctx, corsHeaders);
    }

    if (url.pathname === '/api/autocomplete' && request.method === 'GET') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response;
      return handleAutocompleteRequest(request, corsHeaders);
    }

    if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response;
      return handleClearCache(request, env, corsHeaders);
    }

    if (url.pathname === '/api/cache/list' && request.method === 'GET') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response;
      return handleListCache(env, corsHeaders);
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }
};

/* ── AUTHENTICATION (unchanged) ─────────────────────────────────────────── */

async function handleLogin(request, env, corsHeaders) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 400, corsHeaders);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400, corsHeaders);
    }

    const password = body?.password;
    if (!password) {
      return jsonResponse({ error: 'Password is required' }, 400, corsHeaders);
    }

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) {
      return jsonResponse({ error: 'Password not configured' }, 500, corsHeaders);
    }

    if (password !== expectedPassword) {
      return jsonResponse({ error: 'Invalid password' }, 401, corsHeaders);
    }

    const expiresAt = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const token = await generateToken(expectedPassword, expiresAt);

    return jsonResponse({
      token,
      expiresAt,
      expiresIn: TOKEN_EXPIRY_HOURS * 60 * 60
    }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: 'Failed to process login' }, 500, corsHeaders);
  }
}

async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  try {
    const tokenData = parseToken(token);
    if (!tokenData) return { valid: false, error: 'Invalid token format' };

    if (tokenData.expiresAt < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) return { valid: false, error: 'Password not configured' };

    const isValid = await verifyToken(token, expectedPassword);
    if (!isValid) return { valid: false, error: 'Invalid token' };

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

async function generateToken(password, expiresAt) {
  const encoder = new TextEncoder();
  const payload = `${expiresAt}`;
  const key = await importHmacKey(password, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenData = `${payload}:${signatureHex}`;
  return btoa(tokenData);
}

async function verifyToken(token, password) {
  try {
    const encoder = new TextEncoder();
    const key = await importHmacKey(password, ['verify']);
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return false;
    const tokenExpiresAt = parseInt(parts[0], 10);
    const tokenSignature = parts[1];
    if (!tokenSignature || tokenSignature.length % 2 !== 0) return false;
    const hexMatches = tokenSignature.match(/.{1,2}/g);
    if (!hexMatches) return false;
    const signatureBytes = new Uint8Array(
      hexMatches.map(byte => parseInt(byte, 16))
    );
    const payload = encoder.encode(`${tokenExpiresAt}`);
    return await crypto.subtle.verify('HMAC', key, signatureBytes, payload);
  } catch {
    return false;
  }
}

function parseToken(token) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return null;
    const expiresAt = parseInt(parts[0], 10);
    if (isNaN(expiresAt)) return null;
    return { expiresAt };
  } catch {
    return null;
  }
}

/**
 * Middleware to verify authentication and return error response if invalid
 * @param {Request} request - Request object
 * @param {Object} env - Environment bindings
 * @param {Object} corsHeaders - CORS headers
 * @returns {Promise<{valid: boolean, response?: Response}>}
 */
async function requireAuth(request, env, corsHeaders) {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) {
    return {
      valid: false,
      response: jsonResponse({ error: authResult.error || 'Unauthorized' }, 401, corsHeaders)
    };
  }
  return { valid: true };
}

/**
 * Import crypto key for HMAC operations
 * @param {string} password - Password to use as key
 * @param {string[]} operations - Array of operations ('sign' or 'verify')
 * @returns {Promise<CryptoKey>}
 */
async function importHmacKey(password, operations) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(password);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    operations
  );
}

/* ── AUTOCOMPLETE (unchanged) ───────────────────────────────────────────── */

async function handleAutocompleteRequest(request, corsHeaders) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    if (!query || query.length < 2) {
      return jsonResponse({ suggestions: [] }, 200, corsHeaders);
    }

    const nominatimUrl = `${NOMINATIM_BASE_URL}/search?` +
      `format=json&q=${encodeURIComponent(query)}&limit=${AUTOCOMPLETE_LIMIT}&addressdetails=1&extratags=1`;

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (!response.ok) {
      return jsonResponse({ suggestions: [] }, 200, corsHeaders);
    }

    const data = await response.json();
    const suggestions = data.map(item => {
      const address = item.address || {};
      
      // Build a detailed display name with multiple address components
      const addressFields = [
        address.neighbourhood || address.suburb || address.hamlet || address.residential || address.quarter,
        address.city || address.town || address.village || address.municipality || address.county,
        address.county,
        address.state || address.province || address.region,
        address.country
      ];
      
      // Filter out duplicates and empty values, keeping order
      const parts = [];
      const seen = new Set();
      for (const field of addressFields) {
        if (field && !seen.has(field)) {
          seen.add(field);
          parts.push(field);
        }
      }
      
      // Fallback to original display_name if we couldn't build a good one
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

    return jsonResponse({ suggestions }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ suggestions: [] }, 200, corsHeaders);
  }
}

/* ── CACHE MANAGEMENT ──────────────────────────────────────────────────── */

/**
 * Normalize cache key from location string
 */
function normalizeCacheKey(location) {
  return `location:${location.toLowerCase().replace(/\s+/g, '_')}`;
}

async function handleClearCache(request, env, corsHeaders) {
  try {
    const body = await request.json().catch(() => ({}));
    const location = body.location?.trim();
    
    let deletedCount = 0;
    
    if (location) {
      // Clear cache for a specific location (use normalized key)
      const cacheKey = normalizeCacheKey(location);
      await env.SOLAR_CACHE.delete(cacheKey);
      deletedCount = 1;
    } else {
      // Clear all cache entries
      // List all keys with the "location:" prefix
      let cursor = null;
      do {
        const listResult = await env.SOLAR_CACHE.list({ prefix: 'location:', cursor });
        const keys = listResult.keys;
        
        // Delete all keys in this batch (parallel for better performance)
        await Promise.all(keys.map(key => env.SOLAR_CACHE.delete(key.name)));
        deletedCount += keys.length;
        
        cursor = listResult.listComplete ? null : listResult.cursor;
      } while (cursor);
    }
    
    return jsonResponse({
      success: true,
      message: location
        ? `Cache cleared for location: ${location}`
        : 'All cache entries cleared',
      deletedCount
    }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: 'Failed to clear cache: ' + error.message }, 500, corsHeaders);
  }
}

/**
 * Check if a string looks like coordinates (e.g., "30.2672,-97.7431")
 */
function looksLikeCoordinates(str) {
  if (!str) return false;
  // Match patterns like "30.2672,-97.7431" or "30.2672, -97.7431"
  return /^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(str.trim());
}

async function handleListCache(env, corsHeaders) {
  try {
    const locations = [];
    let cursor = null;

    do {
      const listResult = await env.SOLAR_CACHE.list({ prefix: 'location:', cursor });

      // Fetch each cached entry to get location details
      const entries = await Promise.all(
        listResult.keys.map(async (key) => {
          const data = await env.SOLAR_CACHE.get(key.name, 'json');
          // Only return entries with valid location name (not coordinates) and complete data
          if (data && data.location && data.weather && data.solar && !looksLikeCoordinates(data.location)) {
            // Extract original search value from cache key (reverse normalization)
            // Key format: "location:original_value" -> "original value"
            const originalSearch = key.name
              .replace('location:', '')
              .replace(/_/g, ' ');
            return {
              key: key.name,
              location: data.location,
              originalSearch, // Use this to ensure cache hit
              latitude: data.latitude,
              longitude: data.longitude,
              cachedAt: data.cachedAt || 0
            };
          }
          return null;
        })
      );

      locations.push(...entries.filter(Boolean));
      cursor = listResult.listComplete ? null : listResult.cursor;
    } while (cursor);

    // Sort by most recent first
    locations.sort((a, b) => b.cachedAt - a.cachedAt);

    return jsonResponse({ locations }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: 'Failed to list cache: ' + error.message }, 500, corsHeaders);
  }
}

/* ── DATA ENDPOINT ───────────────────────────────────────────────────────── */

/**
 * Parse and validate location request body
 * @param {Object} body - Request body
 * @returns {{ location: string, apiLocation: string }}
 * @throws {Error} If location is missing
 */
function parseLocationRequest(body) {
  const location = body.location?.trim();
  if (!location) throw new Error('Location is required');

  let apiLocation = location;
  if (body.lat != null && body.lon != null) {
    apiLocation = `${body.lat},${body.lon}`;
  }

  return { location, apiLocation };
}

/**
 * Build Visual Crossing API URL
 * @param {string} apiLocation - Location string or coordinates
 * @param {string} startStr - Start date (ISO format)
 * @param {string} endStr - End date (ISO format)
 * @param {string} apiKey - API key
 * @returns {string} Full API URL
 */
function buildWeatherApiUrl(apiLocation, startStr, endStr, apiKey) {
  const params = new URLSearchParams({
    unitGroup: 'us',
    include: 'days',
    key: apiKey,
    elements: 'datetime,tempmax,tempmin,temp,humidity,solarenergy'
  });

  return `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(apiLocation)}/${startStr}/${endStr}?${params}`;
}

/**
 * Enhance resolved address with reverse geocoding if needed
 * @param {string} resolvedAddress - Address from weather API
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<string>} Enhanced address or original if geocoding fails
 */
async function enhanceResolvedAddress(resolvedAddress, latitude, longitude) {
  if (!looksLikeCoordinates(resolvedAddress)) {
    return resolvedAddress;
  }

  try {
    const nominatimUrl = `${NOMINATIM_BASE_URL}/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const geoResponse = await fetch(nominatimUrl, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      if (geoData.display_name) {
        return geoData.display_name;
      }
    }
  } catch (e) {
    // Keep original if geocoding fails
  }

  return resolvedAddress;
}

/**
 * Process weather data into monthly aggregates
 * @param {Array} days - Array of daily weather data
 * @returns {Array} Monthly weather data
 */
function processWeatherData(days) {
  const weather = [];

  // Pre-group days by month
  const daysByMonth = Array.from({ length: 12 }, () => []);
  for (const day of days) {
    const month = new Date(day.datetime).getMonth();
    if (month >= 0 && month < 12) {
      daysByMonth[month].push(day);
    }
  }

  // Calculate monthly averages
  for (let m = 0; m < 12; m++) {
    const monthDays = daysByMonth[m];
    weather.push({
      month: MONTHS[m],
      highF: round(avg(monthDays, 'tempmax'), 1),
      lowF: round(avg(monthDays, 'tempmin'), 1),
      meanF: round(avg(monthDays, 'temp'), 1),
      humidity: round(avg(monthDays, 'humidity'), 1)
    });
  }

  return weather;
}

/**
 * Process solar data with tilt calculations
 * @param {Array} days - Array of daily weather data
 * @param {number} latitude - Location latitude
 * @returns {Array} Monthly solar data with tilt calculations
 */
function processSolarData(days, latitude) {
  const solar = [];
  const fixedTilt = Math.round(Math.abs(latitude));
  const yearlyDirection = latitude >= 0 ? 'S' : 'N';

  // Pre-group days by month
  const daysByMonth = Array.from({ length: 12 }, () => []);
  for (const day of days) {
    const month = new Date(day.datetime).getMonth();
    if (month >= 0 && month < 12) {
      daysByMonth[month].push(day);
    }
  }

  // Calculate monthly solar data
  for (let m = 0; m < 12; m++) {
    const monthDays = daysByMonth[m];
    const solarEnergyMJ = avg(monthDays, 'solarenergy');
    const flatPSH = solarEnergyMJ / MJ_TO_KWH;

    const monthNum = m + 1;
    const { tilt: monthlyTilt, direction: monthlyDirection } = calculateMonthlyOptimalTilt(latitude, monthNum);
    const monthlyTiltGain = calculateMaxTiltGain(latitude, monthNum);
    const fixedTiltGain = calculateTiltGain(latitude, fixedTilt, monthNum);

    const monthlyPSH = flatPSH * monthlyTiltGain;
    const fixedPSH = flatPSH * Math.min(fixedTiltGain, monthlyTiltGain);

    solar.push({
      month: MONTHS[m],
      monthlyOptimal: {
        tilt: `${monthlyTilt}° ${monthlyDirection}`,
        psh: round(monthlyPSH, 2)
      },
      yearlyFixed: {
        tilt: `${fixedTilt}° ${yearlyDirection}`,
        psh: round(fixedPSH, 2)
      },
      flat: {
        tilt: '0°',
        psh: round(flatPSH, 2)
      }
    });
  }

  return solar;
}

async function handleDataRequest(request, env, ctx, corsHeaders) {
  try {
    const body = await request.json();
    const { location, apiLocation } = parseLocationRequest(body);

    // Check cache
    const cacheKey = normalizeCacheKey(apiLocation);
    const cached = await env.SOLAR_CACHE.get(cacheKey, 'json');
    if (cached) {
      const years = parseInt(env.YEARS_OF_DATA) || DEFAULT_YEARS_OF_DATA;
      return jsonResponse({ ...cached, cached: true, yearsOfData: years }, 200, corsHeaders);
    }

    // Setup API call
    const apiKey = env.VISUAL_CROSSING_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);

    const years = parseInt(env.YEARS_OF_DATA) || DEFAULT_YEARS_OF_DATA;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - years);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch weather data
    const apiUrl = buildWeatherApiUrl(apiLocation, startStr, endStr, apiKey);
    const response = await fetch(apiUrl);

    if (!response.ok) {
      if (response.status === 429) {
        return jsonResponse({ error: 'API rate limit exceeded. Please try again later.' }, 429, corsHeaders);
      }
      return jsonResponse({ error: 'Could not fetch weather data for this location' }, 400, corsHeaders);
    }

    const data = await response.json();
    let { latitude, longitude, resolvedAddress, days } = data;

    if (!days || days.length === 0) {
      return jsonResponse({ error: 'No weather data available for this location' }, 400, corsHeaders);
    }

    resolvedAddress = await enhanceResolvedAddress(resolvedAddress, latitude, longitude);

    if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) {
      return jsonResponse({ error: 'Invalid location coordinates received from API' }, 500, corsHeaders);
    }

    // Process data
    const weather = processWeatherData(days);
    const solar = processSolarData(days, latitude);

    // Build and cache result
    const result = {
      location: resolvedAddress,
      latitude: round(latitude, 4),
      longitude: round(longitude, 4),
      weather,
      solar,
      yearsOfData: years,
      cachedAt: Date.now()
    };

    const cacheTtl = parseInt(env.CACHE_TTL) || DEFAULT_CACHE_TTL;
    ctx.waitUntil(
      env.SOLAR_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: cacheTtl })
    );

    return jsonResponse({ ...result, cached: false }, 200, corsHeaders);

  } catch (error) {
    return jsonResponse({ error: 'Failed to process request: ' + error.message }, 500, corsHeaders);
  }
}

/**
 * Calculate monthly optimal tilt angle and direction
 * @param {number} latitude - Location latitude in degrees
 * @param {number} month - Month number (1-12)
 * @returns {{ tilt: number, direction: string }}
 */
function calculateMonthlyOptimalTilt(latitude, month) {
  const declination = SOLAR_DECLINATIONS[month - 1];

  // The sun's position relative to the location determines optimal direction
  // If sun is north of location: face North
  // If sun is south of location: face South
  const sunPosition = declination; // Sun's latitude position
  const sunIsNorthOfLocation = sunPosition > latitude;

  // Optimal direction: face toward the sun
  let direction;
  if (sunIsNorthOfLocation) {
    direction = 'N';
  } else {
    direction = 'S';
  }

  // Optimal tilt calculation:
  // The optimal tilt angle equals the angle between zenith and the sun at solar noon
  // This is: |latitude - declination| when facing toward the sun
  let optimalTilt = Math.abs(latitude - declination);
  optimalTilt = Math.max(0, Math.min(90, Math.round(optimalTilt)));

  return { tilt: optimalTilt, direction };
}

/**
 * Get latitude-dependent gain range based on location
 * Different latitudes experience different sun angles year-round, affecting tilt benefits
 * @param {number} latitude - Location latitude in degrees
 * @returns {{ minGain: number, maxGain: number }}
 */
function getLatitudeGainRange(latitude) {
  const absLat = Math.abs(latitude);

  if (absLat < LATITUDE_BANDS.EQUATORIAL.max) {
    // Equatorial: Sun nearly overhead year-round, less benefit from tilting
    return {
      minGain: LATITUDE_BANDS.EQUATORIAL.minGain,
      maxGain: LATITUDE_BANDS.EQUATORIAL.maxGain
    };
  } else if (absLat < LATITUDE_BANDS.MID_LATITUDE.max) {
    // Mid-latitude: Moderate sun angles, current model is reasonable
    return {
      minGain: LATITUDE_BANDS.MID_LATITUDE.minGain,
      maxGain: LATITUDE_BANDS.MID_LATITUDE.maxGain
    };
  } else if (absLat < LATITUDE_BANDS.HIGH_LATITUDE.max) {
    // High latitude: Low sun angles, significant benefit from tilting
    return {
      minGain: LATITUDE_BANDS.HIGH_LATITUDE.minGain,
      maxGain: LATITUDE_BANDS.HIGH_LATITUDE.maxGain
    };
  } else {
    // Polar: Extreme low sun angles, very high benefit from tilting
    return {
      minGain: LATITUDE_BANDS.POLAR.minGain,
      maxGain: LATITUDE_BANDS.POLAR.maxGain
    };
  }
}

/**
 * Calculate the maximum tilt gain for a month (when panel is at optimal tilt)
 * Uses latitude-dependent gain ranges to reflect regional solar geometry
 * @param {number} latitude - Location latitude in degrees
 * @param {number} month - Month number (1-12)
 * @returns {number} Maximum gain factor for optimal tilt
 */
function calculateMaxTiltGain(latitude, month) {
  const declination = SOLAR_DECLINATIONS[month - 1];
  
  // Optimal tilt = |latitude - declination|
  const optimalTilt = Math.abs(latitude - declination);
  
  // Solar elevation at noon: 90° - |latitude - declination|
  const noonElevation = 90 - optimalTilt;
  
  // Lower sun elevation means more gain from tilting
  // At 90° elevation (sun directly overhead): minimal benefit from tilting
  // At low elevation (sun low): significant benefit from tilting
  const elevationFactor = 1 - (noonElevation / 90); // 0 at overhead, 1 at horizon

  // Use latitude-dependent gain ranges (varies by region)
  // Equatorial: 1.03-1.15x, Mid-latitude: 1.05-1.40x, High-latitude: 1.15-1.80x, Polar: 1.20-2.20x
  const { minGain, maxGain } = getLatitudeGainRange(latitude);
  const gainRange = maxGain - minGain;
  const gain = minGain + (gainRange * elevationFactor);

  return Math.max(minGain, Math.min(maxGain, gain));
}

/**
 * Calculate tilt gain factor using solar geometry
 * Models how much more energy a tilted panel captures vs horizontal
 * @param {number} latitude - Location latitude in degrees
 * @param {number} tiltAngle - Panel tilt angle in degrees
 * @param {number} month - Month number (1-12)
 * @returns {number} Gain factor (1.0 = same as horizontal)
 */
function calculateTiltGain(latitude, tiltAngle, month) {
  if (tiltAngle === 0) return 1.0;

  const declination = SOLAR_DECLINATIONS[month - 1];

  // Optimal tilt for this month = |latitude - declination|
  const optimalTiltForMonth = Math.abs(latitude - declination);

  // Get the maximum possible gain for this month
  const maxGain = calculateMaxTiltGain(latitude, month);

  // Calculate how close actual tilt is to optimal
  const tiltDifference = Math.abs(tiltAngle - optimalTiltForMonth);
  const tiltDiffRad = (tiltDifference * Math.PI) / 180;

  // Efficiency based on tilt deviation using cos^1.5 for steeper penalty
  // cos(0°)^1.5 = 1.0 (perfect), cos(20°)^1.5 ≈ 0.91, cos(30°)^1.5 ≈ 0.80, cos(45°)^1.5 ≈ 0.60
  // Steeper curve makes fixed tilt deviation more costly, highlighting benefit of monthly adjustments
  const tiltEfficiency = Math.pow(Math.cos(tiltDiffRad), TILT_PENALTY_EXPONENT);

  // Apply efficiency to scale between 1.0 and maxGain
  const gain = 1.0 + (maxGain - 1.0) * tiltEfficiency;

  // Clamp to reasonable range
  return Math.max(1.0, Math.min(maxGain, gain));
}

/* ── UTILITIES ──────────────────────────────────────────────────────────── */

/**
 * Calculate average of array values by key (optimized single-pass)
 */
function avg(arr, key) {
  if (!arr || arr.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (const item of arr) {
    const val = item[key];
    if (val != null && !isNaN(val)) {
      sum += val;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

function round(num, decimals = 1) {
  if (num == null || isNaN(num)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function jsonResponse(data, status = 200, corsHeaders) {
  const headers = {
    'Content-Type': 'application/json',
    ...(corsHeaders || getCorsHeaders(null))
  };
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}