/**
 * CORS middleware
 */

const ALLOWED_ORIGINS = [
  'https://solar-planner.coppertech.us',
  'https://solar-planner.coppertech.co',
  'https://solar-planner.pages.dev',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080'
].map(origin => origin.replace(/\/$/, ''));

/**
 * Validate origin format (basic URL validation)
 */
function isValidOriginFormat(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    // Must be http or https
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Only set CORS headers if origin is valid and allowed
  if (origin && isValidOriginFormat(origin)) {
    const normalizedOrigin = origin.replace(/\/$/, '');
    const isAllowed = ALLOWED_ORIGINS.includes(normalizedOrigin);
    
    if (isAllowed) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      // Origin not allowed - don't set Access-Control-Allow-Origin
      // This prevents the browser from making the request
      headers['Access-Control-Allow-Origin'] = 'null';
    }
  } else {
    // Invalid or missing origin - don't set CORS headers
    headers['Access-Control-Allow-Origin'] = 'null';
  }

  return headers;
}
