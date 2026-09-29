/**
 * Security headers middleware for CTF.
 *
 * These headers complement Cloudflare One Gateway/WAF protections.
 * Even with Cloudflare One enabled, application-level headers provide
 * defense-in-depth and protect against direct origin access.
 *
 * Headers follow OWASP recommendations and Cloudflare best practices.
 */

export interface SecurityHeadersConfig {
  /** Enable HSTS (set to false during initial testing) */
  hsts?: boolean;
  /** Enable CSP (Content Security Policy) */
  csp?: boolean;
  /** Enable X-Frame-Options */
  frameOptions?: boolean;
}

const DEFAULT_CONFIG: SecurityHeadersConfig = {
  hsts: true,
  csp: true,
  frameOptions: true,
};

/**
 * Generate security headers for API responses.
 */
export function getSecurityHeaders(config: SecurityHeadersConfig = {}): Record<string, string> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const headers: Record<string, string> = {};

  // X-Content-Type-Options: prevent MIME sniffing
  headers['X-Content-Type-Options'] = 'nosniff';

  // Referrer-Policy: control referrer information leakage
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

  // Permissions-Policy: disable unnecessary browser features
  headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()';

  // X-Frame-Options: prevent clickjacking
  if (opts.frameOptions) {
    headers['X-Frame-Options'] = 'DENY';
  }

  // Strict-Transport-Security: enforce HTTPS
  if (opts.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
  }

  // Content-Security-Policy: prevent XSS and data injection.
  // `'unsafe-inline'` is required for scripts: Astro inlines the hydration
  // bootstrap for every island, and a static export has no way to attach a nonce.
  // The policy still blocks external script origins, object embedding and framing.
  if (opts.csp) {
    headers['Content-Security-Policy'] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  return headers;
}

/**
 * Apply security headers to a Response object.
 */
export function applySecurityHeaders(
  response: Response,
  config?: SecurityHeadersConfig,
): Response {
  const newResponse = new Response(response.body, response);
  const headers = getSecurityHeaders(config);

  for (const [key, value] of Object.entries(headers)) {
    newResponse.headers.set(key, value);
  }

  return newResponse;
}

/**
 * Middleware wrapper for Astro routes.
 * Usage in +middleware.ts or inline in route handlers.
 */
export function withSecurityHeaders(
  handler: (request: Request) => Promise<Response> | Response,
  config?: SecurityHeadersConfig,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const response = await handler(request);
    return applySecurityHeaders(response, config);
  };
}
