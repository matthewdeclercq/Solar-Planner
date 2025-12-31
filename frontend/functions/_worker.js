/**
 * Cloudflare Pages Functions Worker
 * Proxies /api/* requests to the solar-planner-api worker
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Proxy /api/* requests to your bound worker
    if (url.pathname.startsWith('/api/')) {
      // Forward the request to your bound worker
      // The worker binding should be named SOLAR_PLANNER_API
      return env.SOLAR_PLANNER_API.fetch(request);
    }
    
    // For all other requests, let Pages serve static files
    return fetch(request);
  }
}

