/**
 * Solar Planner API - Cloudflare Worker
 * 
 * Full monthly North/South direction support added
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Solar declination by month (degrees) - positive when sun is north of equator
const SOLAR_DECLINATIONS = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

const DEFAULT_YEARS_OF_DATA = 2;
const DEFAULT_CACHE_TTL = 2592000; // 30 days
const TOKEN_EXPIRY_HOURS = 24;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    if (url.pathname === '/api/data' && request.method === 'POST') {
      const authResult = await verifyAuth(request, env);
      if (!authResult.valid) {
        return jsonResponse({ error: authResult.error || 'Unauthorized' }, 401);
      }
      return handleDataRequest(request, env, ctx);
    }

    if (url.pathname === '/api/autocomplete' && request.method === 'GET') {
      const authResult = await verifyAuth(request, env);
      if (!authResult.valid) {
        return jsonResponse({ error: authResult.error || 'Unauthorized' }, 401);
      }
      return handleAutocompleteRequest(request);
    }

    if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
      const authResult = await verifyAuth(request, env);
      if (!authResult.valid) {
        return jsonResponse({ error: authResult.error || 'Unauthorized' }, 401);
      }
      return handleClearCache(request, env);
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

/* ── AUTHENTICATION (unchanged) ─────────────────────────────────────────── */

async function handleLogin(request, env) {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 400);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400);
    }

    const password = body?.password;
    if (!password) {
      return jsonResponse({ error: 'Password is required' }, 400);
    }

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) {
      return jsonResponse({ error: 'Password not configured' }, 500);
    }

    if (password !== expectedPassword) {
      return jsonResponse({ error: 'Invalid password' }, 401);
    }

    const expiresAt = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const token = await generateToken(expectedPassword, expiresAt);

    return jsonResponse({
      token,
      expiresAt,
      expiresIn: TOKEN_EXPIRY_HOURS * 60 * 60
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ error: 'Failed to process login' }, 500);
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
    console.error('Auth verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

async function generateToken(password, expiresAt) {
  const encoder = new TextEncoder();
  const payload = `${expiresAt}`;
  const keyData = encoder.encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenData = `${payload}:${signatureHex}`;
  return btoa(tokenData);
}

async function verifyToken(token, password) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(password);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return false;
    const tokenExpiresAt = parseInt(parts[0], 10);
    const tokenSignature = parts[1];
    const signatureBytes = new Uint8Array(
      tokenSignature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
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

/* ── AUTOCOMPLETE (unchanged) ───────────────────────────────────────────── */

async function handleAutocompleteRequest(request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    if (!query || query.length < 2) {
      return jsonResponse({ suggestions: [] });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${encodeURIComponent(query)}&limit=8&addressdetails=1&extratags=1`;

    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'Solar-Planner/1.0' }
    });

    if (!response.ok) {
      return jsonResponse({ suggestions: [] });
    }

    const data = await response.json();
    const suggestions = data.map(item => {
      const address = item.address || {};
      
      // Build a detailed display name with multiple address components
      const parts = [];
      
      // Primary location name (neighborhood, suburb, or place name)
      const primaryName = address.neighbourhood || address.suburb || address.hamlet || 
                          address.residential || address.quarter;
      
      // City/town/village
      const cityName = address.city || address.town || address.village || 
                       address.municipality || address.county;
      
      // Add primary name if different from city
      if (primaryName && primaryName !== cityName) {
        parts.push(primaryName);
      }
      
      // Add city/town/village
      if (cityName) {
        parts.push(cityName);
      }
      
      // Add county if different from city (useful for US locations)
      if (address.county && address.county !== cityName && !parts.includes(address.county)) {
        parts.push(address.county);
      }
      
      // Add state/province/region
      const stateName = address.state || address.province || address.region;
      if (stateName) {
        parts.push(stateName);
      }
      
      // Add country
      if (address.country) {
        parts.push(address.country);
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

    return jsonResponse({ suggestions });
  } catch (error) {
    console.error('Autocomplete error:', error);
    return jsonResponse({ suggestions: [] });
  }
}

/* ── CACHE MANAGEMENT ──────────────────────────────────────────────────── */

async function handleClearCache(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const location = body.location?.trim();
    
    let deletedCount = 0;
    
    if (location) {
      // Clear cache for a specific location
      const cacheKey = `location:${location.toLowerCase().replace(/\s+/g, '_')}`;
      await env.SOLAR_CACHE.delete(cacheKey);
      deletedCount = 1;
    } else {
      // Clear all cache entries
      // List all keys with the "location:" prefix
      let cursor = null;
      do {
        const listResult = await env.SOLAR_CACHE.list({ prefix: 'location:', cursor });
        const keys = listResult.keys;
        
        // Delete all keys in this batch
        for (const key of keys) {
          await env.SOLAR_CACHE.delete(key.name);
          deletedCount++;
        }
        
        cursor = listResult.listComplete ? null : listResult.cursor;
      } while (cursor);
    }
    
    return jsonResponse({ 
      success: true,
      message: location 
        ? `Cache cleared for location: ${location}` 
        : 'All cache entries cleared',
      deletedCount
    });
  } catch (error) {
    console.error('Clear cache error:', error);
    return jsonResponse({ error: 'Failed to clear cache: ' + error.message }, 500);
  }
}

/* ── DATA ENDPOINT ───────────────────────────────────────────────────────── */

async function handleDataRequest(request, env, ctx) {
  try {
    const body = await request.json();
    const location = body.location?.trim();
    if (!location) return jsonResponse({ error: 'Location is required' }, 400);

    let apiLocation = location;
    if (body.lat != null && body.lon != null) {
      apiLocation = `${body.lat},${body.lon}`;
    }

    const cacheKey = `location:${location.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = await env.SOLAR_CACHE.get(cacheKey, 'json');
    if (cached) {
      const years = parseInt(env.YEARS_OF_DATA) || DEFAULT_YEARS_OF_DATA;
      return jsonResponse({ ...cached, cached: true, yearsOfData: years });
    }

    const apiKey = env.VISUAL_CROSSING_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'API key not configured' }, 500);

    const years = parseInt(env.YEARS_OF_DATA) || DEFAULT_YEARS_OF_DATA;
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - years);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Single API call with all needed elements
    // latitude, longitude, resolvedAddress come from response root automatically
    const params = new URLSearchParams({
      unitGroup: 'us',
      include: 'days',
      key: apiKey,
      elements: 'datetime,tempmax,tempmin,temp,humidity,solarenergy,solarradiation,sunrise,sunset'
    });

    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(apiLocation)}/${startStr}/${endStr}?${params}`;
    
    console.log(`[API] Fetching data for: ${apiLocation}`);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Error ${response.status}: ${errorText}`);
      if (response.status === 429) {
        return jsonResponse({ error: 'API rate limit exceeded. Please try again later.' }, 429);
      }
      return jsonResponse({ error: 'Could not fetch weather data for this location' }, 400);
    }

    const data = await response.json();
    const { latitude, longitude, resolvedAddress, days } = data;

    if (!days || days.length === 0) {
      return jsonResponse({ error: 'No weather data available for this location' }, 400);
    }

    console.log(`[API] Received ${days.length} days of data for ${resolvedAddress}`);

    // Calculate yearly fixed tilt (equals latitude)
    const fixedTilt = Math.round(Math.abs(latitude));
    const yearlyDirection = latitude >= 0 ? 'S' : 'N';

    const weather = [];
    const solar = [];

    for (let m = 0; m < 12; m++) {
      // Filter days for this month
      const monthDays = days.filter(d => new Date(d.datetime).getMonth() === m);

      // Calculate averages for weather data
      const avg = (arr, key) => {
        const vals = arr.map(d => d[key]).filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      };

      const highF = avg(monthDays, 'tempmax');
      const lowF = avg(monthDays, 'tempmin');
      const meanF = avg(monthDays, 'temp');
      const humidity = avg(monthDays, 'humidity');
      
      // solarenergy from Visual Crossing is in MJ/m²/day (megajoules per square meter)
      // Convert to kWh/m²/day (PSH) by dividing by 3.6 (since 1 kWh = 3.6 MJ)
      const solarEnergyMJ = avg(monthDays, 'solarenergy');
      const flatPSH = solarEnergyMJ / 3.6;

      // Calculate sunshine hours from sunrise/sunset
      let sunshineHours = 0;
      const daylightData = monthDays.filter(d => d.sunrise && d.sunset);
      if (daylightData.length > 0) {
        const totalDaylight = daylightData.reduce((sum, d) => {
          const sunrise = parseTime(d.sunrise);
          const sunset = parseTime(d.sunset);
          return sum + (sunset - sunrise) / 3600; // Convert seconds to hours
        }, 0);
        // Adjust daylight by solar radiation factor (accounts for clouds)
        const avgRadiation = avg(monthDays, 'solarradiation');
        const clearSkyFactor = Math.min(1, avgRadiation / 800); // 800 W/m² is typical clear sky
        sunshineHours = (totalDaylight / daylightData.length) * clearSkyFactor;
      }

      weather.push({
        month: MONTHS[m],
        highF: round(highF, 1),
        lowF: round(lowF, 1),
        meanF: round(meanF, 1),
        humidity: round(humidity, 1),
        sunshineHours: round(sunshineHours, 1)
      });

      // Calculate PSH for tilted panels using solar geometry
      const monthNum = m + 1;
      const { tilt: monthlyTilt, direction: monthlyDirection } = calculateMonthlyOptimalTilt(latitude, monthNum);
      
      // Calculate tilt gains using solar geometry
      // Monthly optimal always gets maximum gain (it's the optimal by definition)
      const monthlyTiltGain = calculateMaxTiltGain(latitude, monthNum);
      // Fixed tilt gets gain based on how close it is to monthly optimal
      const fixedTiltGain = calculateTiltGain(latitude, fixedTilt, monthNum);

      // Ensure hierarchy: monthly >= fixed >= flat
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

    const result = {
      location: resolvedAddress,
      latitude: round(latitude, 4),
      longitude: round(longitude, 4),
      weather,
      solar,
      yearsOfData: years
    };

    ctx.waitUntil(
      env.SOLAR_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: DEFAULT_CACHE_TTL })
    );

    return jsonResponse({ ...result, cached: false });

  } catch (error) {
    console.error('Data request error:', error);
    return jsonResponse({ error: 'Failed to process request: ' + error.message }, 500);
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
 * Calculate the maximum tilt gain for a month (when panel is at optimal tilt)
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
  // At 90° elevation (sun directly overhead): no benefit from tilting
  // At 20° elevation (sun low): significant benefit from tilting
  const elevationFactor = 1 - (noonElevation / 90); // 0 at overhead, 1 at horizon
  
  // Base gain: 5% minimum + up to 35% more based on sun angle
  // This gives realistic gains of 1.05x to 1.40x
  const gain = 1.05 + (0.35 * elevationFactor);
  
  return Math.max(1.05, Math.min(1.45, gain));
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

  // Efficiency based on tilt deviation
  // cos(0°) = 1.0 (perfect), cos(45°) ≈ 0.71, cos(90°) = 0
  const tiltEfficiency = Math.cos(tiltDiffRad);

  // Apply efficiency to scale between 1.0 and maxGain
  const gain = 1.0 + (maxGain - 1.0) * tiltEfficiency;

  // Clamp to reasonable range
  return Math.max(1.0, Math.min(maxGain, gain));
}

/**
 * Parse time string (HH:MM:SS) to seconds since midnight
 */
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/* ── UTILITIES ──────────────────────────────────────────────────────────── */

function round(num, decimals = 1) {
  if (num == null) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}