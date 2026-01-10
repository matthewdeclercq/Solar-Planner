/**
 * Data route handler
 */

import type { Env, LocationDataResponse } from '../types';
import { jsonResponse } from '../utils/response';
import { normalizeCacheKey } from '../utils/cache';
import { parseLocationRequest } from '../utils/validation';
import { round } from '../utils/math';
import { fetchWeatherData, processWeatherData } from '../services/weather';
import { processSolarData } from '../services/solar';

const DEFAULT_YEARS_OF_DATA = 2;
const DEFAULT_CACHE_TTL = 2592000; // 30 days

export async function handleDataRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json();
    const { location, apiLocation } = parseLocationRequest(body);

    // Check cache
    const cacheKey = normalizeCacheKey(apiLocation);
    const cached = await env.SOLAR_CACHE.get(cacheKey, 'json') as LocationDataResponse | null;
    if (cached) {
      const years = parseInt(env.YEARS_OF_DATA || '') || DEFAULT_YEARS_OF_DATA;
      return jsonResponse({ ...cached, cached: true, yearsOfData: years }, 200, corsHeaders);
    }

    // Fetch weather data
    const apiKey = env.VISUAL_CROSSING_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);
    }

    const years = parseInt(env.YEARS_OF_DATA || '') || DEFAULT_YEARS_OF_DATA;
    const { data: weatherData, resolvedAddress } = await fetchWeatherData(apiLocation, apiKey, years);

    // Process data
    const weather = processWeatherData(weatherData.days);
    const solar = processSolarData(weatherData.days, weatherData.latitude);

    // Build and cache result
    const result = {
      location: resolvedAddress,
      latitude: round(weatherData.latitude, 4),
      longitude: round(weatherData.longitude, 4),
      weather,
      solar,
      yearsOfData: years,
      cachedAt: Date.now()
    };

    const cacheTtl = parseInt(env.CACHE_TTL || '') || DEFAULT_CACHE_TTL;
    ctx.waitUntil(
      env.SOLAR_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: cacheTtl })
    );

    return jsonResponse({ ...result, cached: false }, 200, corsHeaders);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to process request: ${message}` }, 500, corsHeaders);
  }
}
