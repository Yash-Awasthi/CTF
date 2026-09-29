/**
 * Cloudflare Access-aware authentication helper for CTF admin routes.
 *
 * When Cloudflare Access is enabled, requests to admin endpoints carry
 * special headers set by Access proxying. This module checks those headers
 * to provide an additional layer of identity verification beyond the
 * application-level cookie auth.
 *
 * Cloudflare Access headers:
 * - Cf-Access-Jwt-Assertion: The Access JWT
 * - Cf-Access-Authenticated-User-Email: The authenticated user's email
 * - Cf-Access-Authenticated-User-Id: The Access user ID
 * - Cf-Access-Authenticated-User-Groups: Comma-separated group names
 * - Cf-Access-Authenticated-User-Ray: The Access request ID
 *
 * See: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/
 */
import { getEnv } from '../runtime';

export interface AccessIdentity {
  email: string;
  userId: string;
  groups: string[];
  requestId: string;
  jwt: string;
}

/**
 * Extract Cloudflare Access identity from request headers.
 * Returns null if Access is not enabled or headers are missing.
 */
/**
 * Verify the request came through Cloudflare proxy.
 * Checks for the cf-ray header (always present on Cloudflare-proxied requests)
 * and the absence of a spoofable direct-origin pattern.
 */
function isCloudflareProxied(request: Request): boolean {
  const cfRay = request.headers.get('cf-ray');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  // Cloudflare always sets cf-ray; direct-origin requests won't have it.
  // cf-connecting-ip is also set by Cloudflare and not client-controllable.
  return !!(cfRay && cfConnectingIp);
}

/**
 * Extract Cloudflare Access identity from request headers.
 * Returns null if Access is not enabled, headers are missing,
 * or the request did not come through Cloudflare proxy.
 *
 * SECURITY: We verify the request came through Cloudflare proxy
 * before trusting Access headers, since these headers can be
 * spoofed by direct-origin requests.
 */
export function getAccessIdentity(request: Request): AccessIdentity | null {
  // CRITICAL: Verify request came through Cloudflare proxy.
  // Without this, an attacker can set Cf-Access-* headers on a
  // direct-origin request and impersonate any admin.
  if (!isCloudflareProxied(request)) return null;

  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  const userId = request.headers.get('Cf-Access-Authenticated-User-Id');
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const requestId = request.headers.get('Cf-Access-Authenticated-User-Ray');
  const groupsHeader = request.headers.get('Cf-Access-Authenticated-User-Groups');

  if (!email || !jwt) return null;

  return {
    email,
    userId: userId || '',
    groups: groupsHeader ? groupsHeader.split(',').map((g) => g.trim()) : [],
    requestId: requestId || '',
    jwt,
  };
}

/**
 * Verify that a request came through Cloudflare Access.
 * Use this in admin routes to ensure identity verification.
 *
 * @returns true if Access identity is present and valid
 */
export function hasValidAccessIdentity(request: Request): boolean {
  const identity = getAccessIdentity(request);
  return identity !== null && identity.email.length > 0;
}

/**
 * Get the Access-required admin email(s) from environment.
 * Supports multiple emails separated by commas.
 */
export function getAccessAdminEmails(): string[] {
  const env = getEnv() as unknown as { ACCESS_ADMIN_EMAILS?: string };
  const emails = (env as Record<string, unknown>).ACCESS_ADMIN_EMAILS as string | undefined;
  if (!emails) return [];
  return emails.split(',').map((e) => e.trim().toLowerCase());
}

/**
 * Verify that the Access identity belongs to an authorized admin.
 *
 * @returns true if the email matches an authorized admin
 */
export function isAccessAdmin(request: Request): boolean {
  const identity = getAccessIdentity(request);
  if (!identity) return false;

  const adminEmails = getAccessAdminEmails();
  if (adminEmails.length === 0) {
    // SECURITY: When no admin emails are configured, deny by default.
    // The previous behavior (return true) opened the admin panel to
    // anyone with an Access identity or no identity at all.
    console.warn('[ACCESS] No ACCESS_ADMIN_EMAILS configured — denying access');
    return false;
  }

  return adminEmails.includes(identity.email.toLowerCase());
}

/**
 * Enhanced admin guard that combines:
 * 1. Application-level cookie auth (existing `isAdmin()`)
 * 2. Cloudflare Access identity verification (if enabled)
 *
 * Use this as a replacement for `guardAdmin()` in routes that should
 * be protected by both layers.
 */
export function guardAdminWithAccess(
  request: Request,
  isAdmin: boolean,
): { allowed: boolean; reason?: string; accessIdentity?: AccessIdentity } {
  // First: check application-level auth
  if (!isAdmin) {
    return { allowed: false, reason: 'unauthenticated' };
  }

  // Second: if Cloudflare Access is configured, verify identity
  const adminEmails = getAccessAdminEmails();
  if (adminEmails.length > 0) {
    const identity = getAccessIdentity(request);
    if (!identity) {
      return { allowed: false, reason: 'access_identity_missing' };
    }
    if (!adminEmails.includes(identity.email.toLowerCase())) {
      return { allowed: false, reason: 'access_not_authorized', accessIdentity: identity };
    }
    return { allowed: true, accessIdentity: identity };
  }

  return { allowed: true };
}
