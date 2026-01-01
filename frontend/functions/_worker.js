/**
 * Cloudflare Pages Functions Worker
 * Proxies /api/* requests to the solar-planner-api worker
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Proxy /api/* requests to your bound worker
    if (url.pathname.startsWith('/api/')) {
      // Check if worker binding exists
      if (!env.SOLAR_PLANNER_API) {
        return new Response(JSON.stringify({ 
          error: 'Worker binding not configured',
          path: url.pathname,
          method: request.method
        }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Forward the request to your bound worker
      // For POST requests, we need to ensure the body is preserved
      // Clone the request to avoid consuming the body stream
      const clonedRequest = request.clone();
      
      // Forward the cloned request to the bound worker
      return env.SOLAR_PLANNER_API.fetch(clonedRequest);
    }
    
    // For all other requests, let Pages serve static files
    return fetch(request);
  }
}

