/**
 * Solar Planner API - Cloudflare Worker
 * 
 * Proxies requests to Visual Crossing Weather API, calculates monthly averages
 * and peak sun hours for solar panels, and caches results in KV.
 */

// CORS headers for cross-origin requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Month names for output
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Solar declination approximation for each month (degrees)
// Positive in summer (N hemisphere), negative in winter
const SOLAR_DECLINATIONS = [-20.9, -13.0, -2.4, 9.4, 18.8, 23.1, 21.2, 13.5, 2.2, -9.6, -18.9, -23.0];

// Constants
const YEARS_OF_DATA = 5;
const SECONDS_PER_HOUR = 3600;
const TYPICAL_PEAK_IRRADIANCE = 0.8; // kW/m²
const CLEAR_SKY_RADIATION = 800; // W/m²
const DEFAULT_CACHE_TTL = 2592000; // 30 days in seconds
const TOKEN_EXPIRY_HOURS = 24; // Token expires after 24 hours

/**
 * Main request handler
 */
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Route: POST /api/login (public)
    if (url.pathname === '/api/login' && request.method === 'POST') {
      return handleLogin(request, env);
    }

    // Route: POST /api/data (protected)
    if (url.pathname === '/api/data' && request.method === 'POST') {
      const authResult = await verifyAuth(request, env);
      if (!authResult.valid) {
        return jsonResponse({ error: authResult.error || 'Unauthorized' }, 401);
      }
      return handleDataRequest(request, env);
    }

    // Route: GET /api/health (public)
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

/**
 * Handle login request
 */
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const password = body.password;

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) {
      return jsonResponse({ error: 'Password not configured' }, 500);
    }

    if (password !== expectedPassword) {
      return jsonResponse({ error: 'Invalid password' }, 401);
    }

    // Generate token with 24-hour expiration
    const expiresAt = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const token = await generateToken(expectedPassword, expiresAt);

    return jsonResponse({
      token,
      expiresAt,
      expiresIn: TOKEN_EXPIRY_HOURS * 60 * 60 // seconds
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({ error: 'Failed to process login' }, 500);
  }
}

/**
 * Verify authentication token
 */
async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  
  try {
    const tokenData = parseToken(token);
    
    if (!tokenData) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Check expiration
    if (tokenData.expiresAt < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    // Verify token signature
    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) {
      return { valid: false, error: 'Password not configured' };
    }

    const isValid = await verifyToken(token, expectedPassword);
    if (!isValid) {
      return { valid: false, error: 'Invalid token' };
    }

    return { valid: true };
  } catch (error) {
    console.error('Auth verification error:', error);
    return { valid: false, error: 'Token verification failed' };
  }
}

/**
 * Generate a signed token with expiration using HMAC
 */
async function generateToken(password, expiresAt) {
  const encoder = new TextEncoder();
  const payload = `${expiresAt}`;
  const keyData = encoder.encode(password);
  
  // Import key for HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the payload
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  
  // Combine payload and signature: base64(payload:signature)
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenData = `${payload}:${signatureHex}`;
  
  return btoa(tokenData);
}

/**
 * Verify token signature
 */
async function verifyToken(token, password) {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(password);
    
    // Import key for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode token
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return false;
    
    const tokenExpiresAt = parseInt(parts[0], 10);
    const tokenSignature = parts[1];
    
    // Verify signature
    const signatureBytes = new Uint8Array(
      tokenSignature.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    const payload = encoder.encode(`${tokenExpiresAt}`);
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, payload);
    
    return isValid;
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

/**
 * Parse token to extract expiration time
 */
function parseToken(token) {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return null;
    
    const expiresAt = parseInt(parts[0], 10);
    if (isNaN(expiresAt)) return null;

    return { expiresAt };
  } catch (error) {
    return null;
  }
}

/**
 * Handle the main data request
 */
async function handleDataRequest(request, env) {
  try {
    const body = await request.json();
    const location = body.location?.trim();

    if (!location) {
      return jsonResponse({ error: 'Location is required' }, 400);
    }

    // Normalize location for cache key
    const cacheKey = `location:${location.toLowerCase().replace(/\s+/g, '_')}`;

    // Check cache first
    const cached = await env.SOLAR_CACHE.get(cacheKey, 'json');
    if (cached) {
      return jsonResponse({ ...cached, cached: true });
    }

    // Fetch data from Visual Crossing API
    const apiKey = env.VISUAL_CROSSING_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'API key not configured' }, 500);
    }

    const weatherData = await fetchWeatherData(location, apiKey);
    
    if (weatherData.error) {
      return jsonResponse({ error: weatherData.error }, 400);
    }

    // Calculate monthly averages and PSH
    const result = calculateMonthlyData(weatherData);

    // Cache the result (30 days TTL)
    const ttl = parseInt(env.CACHE_TTL) || DEFAULT_CACHE_TTL;
    await env.SOLAR_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });

    return jsonResponse({ ...result, cached: false });

  } catch (error) {
    console.error('Error processing request:', error);
    return jsonResponse({ error: 'Failed to process request: ' + error.message }, 500);
  }
}

/**
 * Fetch historical weather data from Visual Crossing API
 */
async function fetchWeatherData(location, apiKey) {
  try {
    // Fetch historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - YEARS_OF_DATA);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const params = new URLSearchParams({
      unitGroup: 'metric',
      include: 'days',
      key: apiKey,
      elements: 'datetime,tempmax,tempmin,temp,humidity,solarradiation,solarenergy,uvindex,sunrise,sunset'
    });

    const apiUrl = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${startStr}/${endStr}?${params}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      if (response.status === 400) {
        return { error: 'Location not found. Please check the spelling and try again.' };
      }
      if (response.status === 401 || response.status === 403) {
        return { error: 'API authentication failed.' };
      }
      return { error: `Weather API error: ${response.status}` };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Handle network errors or JSON parsing failures
    console.error('Weather API fetch error:', error);
    return { error: 'Failed to fetch weather data. Please try again later.' };
  }
}

/**
 * Calculate monthly averages and peak sun hours from daily data
 */
function calculateMonthlyData(weatherData) {
  const latitude = weatherData.latitude;
  const longitude = weatherData.longitude;
  const resolvedAddress = weatherData.resolvedAddress;
  const days = weatherData.days || [];

  // Initialize monthly accumulators
  const monthlyData = Array.from({ length: 12 }, () => ({
    tempMax: [],
    tempMin: [],
    tempMean: [],
    humidity: [],
    solarEnergy: [],
    solarRadiation: [],
    daylightHours: []
  }));

  // Accumulate daily data by month
  for (const day of days) {
    const date = new Date(day.datetime);
    const month = date.getMonth();
    const monthData = monthlyData[month];

    // Accumulate temperature data
    if (day.tempmax != null) monthData.tempMax.push(day.tempmax);
    if (day.tempmin != null) monthData.tempMin.push(day.tempmin);
    if (day.temp != null) monthData.tempMean.push(day.temp);
    
    // Accumulate other metrics
    if (day.humidity != null) monthData.humidity.push(day.humidity);
    if (day.solarenergy != null) monthData.solarEnergy.push(day.solarenergy);
    if (day.solarradiation != null) monthData.solarRadiation.push(day.solarradiation);

    // Calculate daylight hours from sunrise/sunset if available
    if (day.sunrise && day.sunset) {
      const sunrise = parseTime(day.sunrise);
      const sunset = parseTime(day.sunset);
      if (sunrise && sunset) {
        monthData.daylightHours.push((sunset - sunrise) / SECONDS_PER_HOUR);
      }
    }
  }

  // Calculate averages and format output
  const weather = [];
  const solar = [];

  for (let i = 0; i < 12; i++) {
    const data = monthlyData[i];

    // Weather averages (convert C to F)
    const highC = average(data.tempMax);
    const lowC = average(data.tempMin);
    const meanC = average(data.tempMean);

    weather.push({
      month: MONTHS[i],
      highF: round(celsiusToFahrenheit(highC), 1),
      lowF: round(celsiusToFahrenheit(lowC), 1),
      meanF: round(celsiusToFahrenheit(meanC), 1),
      humidity: round(average(data.humidity), 1),
      sunshineHours: round(estimateSunshineHours(data), 1)
    });

    // Calculate PSH for three scenarios
    const avgSolarEnergy = average(data.solarEnergy); // kWh/m²/day on horizontal surface
    const monthNum = i + 1;

    // Calculate tilt angles
    const flatTilt = 0;
    const yearlyOptimalTilt = round(Math.abs(latitude), 0); // Tilt ≈ latitude
    const monthlyOptimalTilt = calculateMonthlyOptimalTilt(latitude, monthNum);

    // Calculate PSH for each scenario
    // solarenergy from Visual Crossing is already in kWh/m²/day for horizontal surface
    const flatPSH = round(avgSolarEnergy, 2);
    const yearlyOptimalPSH = round(adjustPSHForTilt(avgSolarEnergy, yearlyOptimalTilt, monthlyOptimalTilt), 2);
    const monthlyOptimalPSH = round(adjustPSHForTilt(avgSolarEnergy, monthlyOptimalTilt, monthlyOptimalTilt), 2);

    solar.push({
      month: MONTHS[i],
      monthlyOptimal: {
        tilt: monthlyOptimalTilt,
        psh: monthlyOptimalPSH
      },
      yearlyFixed: {
        tilt: yearlyOptimalTilt,
        psh: yearlyOptimalPSH
      },
      flat: {
        tilt: flatTilt,
        psh: flatPSH
      }
    });
  }

  return {
    location: resolvedAddress,
    latitude: round(latitude, 4),
    longitude: round(longitude, 4),
    weather,
    solar
  };
}

/**
 * Calculate monthly optimal tilt angle based on latitude and month
 * Uses simplified formula: tilt = latitude - (15° adjustment based on season)
 */
function calculateMonthlyOptimalTilt(latitude, month) {
  const declination = SOLAR_DECLINATIONS[month - 1];

  // For Northern Hemisphere: tilt = latitude - declination
  // For Southern Hemisphere: tilt = -latitude - declination (then take absolute)
  let optimalTilt;
  if (latitude >= 0) {
    optimalTilt = latitude - declination;
  } else {
    optimalTilt = Math.abs(latitude) + declination;
  }

  // Clamp to reasonable range (0-90 degrees)
  optimalTilt = Math.max(0, Math.min(90, optimalTilt));

  return round(optimalTilt, 0);
}

/**
 * Adjust PSH for tilted panel surface
 * This is a simplified model using the tilt factor approach
 * @param {number} horizontalPSH - PSH on horizontal surface (kWh/m²/day)
 * @param {number} tiltAngle - Actual tilt angle of the panel (degrees)
 * @param {number} optimalTilt - Optimal tilt angle for this month (degrees)
 */
function adjustPSHForTilt(horizontalPSH, tiltAngle, optimalTilt) {
  if (!horizontalPSH || horizontalPSH === 0) return 0;
  
  // Simplified tilt gain model: panels tilted toward optimal angle capture more direct radiation
  // Gain is maximum when tilt matches optimal, decreases with angle difference
  const tiltDifference = Math.abs(tiltAngle - optimalTilt);
  const angleDiffRad = (tiltDifference * Math.PI) / 180;
  const tiltGain = Math.cos(angleDiffRad);
  
  // Clamp gain to reasonable range (0.85 to 1.4)
  // Even poorly tilted panels get some benefit, optimally tilted get significant boost
  return horizontalPSH * Math.max(0.85, Math.min(1.4, tiltGain));
}

/**
 * Estimate sunshine hours from solar data
 */
function estimateSunshineHours(monthData) {
  // If we have daylight hours, use them directly
  if (monthData.daylightHours.length > 0) {
    const avgDaylight = average(monthData.daylightHours);
    // Adjust by a cloud factor based on solar radiation
    const avgRadiation = average(monthData.solarRadiation);
    // Typical clear-sky radiation is around 800-1000 W/m²
    const clearSkyFactor = avgRadiation > 0 ? Math.min(1, avgRadiation / CLEAR_SKY_RADIATION) : 0.5;
    return avgDaylight * clearSkyFactor;
  }

  // Fallback: estimate from solar energy
  // solarenergy (kWh/m²/day) / typical peak irradiance (0.8 kW/m²)
  const avgSolarEnergy = average(monthData.solarEnergy);
  return avgSolarEnergy > 0 ? avgSolarEnergy / TYPICAL_PEAK_IRRADIANCE : 0;
}

/**
 * Parse time string (HH:MM:SS) to seconds since midnight
 */
function parseTime(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parts.length > 2 ? parseInt(parts[2], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Convert Celsius to Fahrenheit
 */
function celsiusToFahrenheit(celsius) {
  if (celsius == null) return null;
  return celsius * 9 / 5 + 32;
}

/**
 * Calculate average of an array
 */
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

/**
 * Round a number to specified decimal places
 */
function round(num, decimals) {
  if (num == null) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

/**
 * Create a JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

