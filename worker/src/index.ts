/**
 * Solar Planner API - Cloudflare Worker
 * Main entry point
 */

import type { Env } from './types';
import { getCorsHeaders } from './middleware/cors';
import { jsonResponse } from './utils/response';
import { handleLogin, requireAuth } from './services/auth';
import { handleDataRequest } from './routes/data';
import { handleAutocompleteRequest } from './routes/autocomplete';
import { handleClearCache, handleListCache } from './routes/cache';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
      if (!auth.valid) return auth.response!;
      return handleDataRequest(request, env, ctx, corsHeaders);
    }

    if (url.pathname === '/api/autocomplete' && request.method === 'GET') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response!;
      return handleAutocompleteRequest(request, corsHeaders);
    }

    if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response!;
      return handleClearCache(request, env, corsHeaders);
    }

    if (url.pathname === '/api/cache/list' && request.method === 'GET') {
      const auth = await requireAuth(request, env, corsHeaders);
      if (!auth.valid) return auth.response!;
      return handleListCache(env, corsHeaders);
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() }, 200, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  }
};
