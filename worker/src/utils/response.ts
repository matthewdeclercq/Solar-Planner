/**
 * Response utilities
 */

/**
 * Get Content-Security-Policy header value
 */
function getCSPHeader(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Vite dev, unsafe-inline for Alpine.js
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' http://localhost:8787 https://solar-planner-api.matthew-declercq.workers.dev https://*.workers.dev",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function jsonResponse(
  data: unknown, 
  status = 200, 
  corsHeaders?: Record<string, string>
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Content-Security-Policy': getCSPHeader(),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...(corsHeaders || {}),
  };
  return new Response(JSON.stringify(data), {
    status,
    headers,
  });
}
