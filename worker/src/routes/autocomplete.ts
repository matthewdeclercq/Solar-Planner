/**
 * Autocomplete route handler
 */

import type { Env, AutocompleteResponse } from '../types';
import { jsonResponse } from '../utils/response';
import { getCorsHeaders } from '../middleware/cors';
import { searchLocations } from '../services/geocoding';

export async function handleAutocompleteRequest(
  request: Request,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.trim();
    
    if (!query || query.length < 2) {
      return jsonResponse({ suggestions: [] }, 200, corsHeaders);
    }

    const suggestions = await searchLocations(query);
    return jsonResponse({ suggestions }, 200, corsHeaders);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const timestamp = new Date().toISOString();
    
    console.error('[Autocomplete Error]', {
      timestamp,
      message: errorMessage,
      stack: errorStack,
      url: request.url,
      query: new URL(request.url).searchParams.get('q'),
    });
    
    // Return empty array to maintain API contract, but error is now logged
    return jsonResponse({ suggestions: [] }, 200, corsHeaders);
  }
}
