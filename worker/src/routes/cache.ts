/**
 * Cache management route handlers
 */

import type { Env, CacheClearRequest, CacheClearResponse, CacheListResponse, CachedLocation } from '../types';
import { jsonResponse } from '../utils/response';
import { normalizeCacheKey, looksLikeCoordinates } from '../utils/cache';

export async function handleClearCache(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({})) as CacheClearRequest;
    const location = body.location?.trim();
    
    let deletedCount = 0;
    
    if (location) {
      const cacheKey = normalizeCacheKey(location);
      await env.SOLAR_CACHE.delete(cacheKey);
      deletedCount = 1;
    } else {
      let cursor: string | null = null;
      do {
        const listResult: KVNamespaceListResult<unknown> = await env.SOLAR_CACHE.list({ prefix: 'location:', cursor });
        const keys = listResult.keys;
        
        await Promise.all(keys.map(key => env.SOLAR_CACHE.delete(key.name)));
        deletedCount += keys.length;
        
        cursor = listResult.list_complete ? null : listResult.cursor;
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to clear cache: ${message}` }, 500, corsHeaders);
  }
}

export async function handleListCache(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const locations: CachedLocation[] = [];
    let cursor: string | null = null;

    do {
      const listResult: KVNamespaceListResult<unknown> = await env.SOLAR_CACHE.list({ prefix: 'location:', cursor });

      const entries = await Promise.all(
        listResult.keys.map(async (key) => {
          const data = await env.SOLAR_CACHE.get(key.name, 'json') as {
            location?: string;
            latitude?: number;
            longitude?: number;
            cachedAt?: number;
          } | null;
          
          if (data && data.location && data.latitude != null && data.longitude != null && !looksLikeCoordinates(data.location)) {
            const originalSearch = key.name
              .replace('location:', '')
              .replace(/_/g, ' ');
            return {
              key: key.name,
              location: data.location,
              originalSearch,
              latitude: data.latitude,
              longitude: data.longitude,
              cachedAt: data.cachedAt || 0
            };
          }
          return null;
        })
      );

      locations.push(...entries.filter((e): e is CachedLocation => e !== null));
      cursor = listResult.list_complete ? null : listResult.cursor;
    } while (cursor);

    locations.sort((a, b) => b.cachedAt - a.cachedAt);

    return jsonResponse({ locations }, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: `Failed to list cache: ${message}` }, 500, corsHeaders);
  }
}
