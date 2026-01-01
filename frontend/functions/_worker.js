/**
 * Cloudflare Pages Functions Worker
 * Proxies /api/* requests to the solar-planner-api worker
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    
    // Proxy /api/* requests to your bound worker
    if (url.pathname.startsWith('/api/')) {
      // Check if worker binding exists
      if (!env.SOLAR_PLANNER_API) {
        return new Response(JSON.stringify({ 
          error: 'Worker binding not configured',
          message: 'Please configure the SOLAR_PLANNER_API worker binding in Cloudflare Pages settings',
          path: url.pathname,
          method: request.method
        }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      
      // Forward the request to the bound worker
      try {
        const response = await env.SOLAR_PLANNER_API.fetch(request);
        return response;
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Failed to forward request to worker',
          message: error.message
        }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // For all other requests, let Pages serve static files
    return fetch(request);
  }
}

