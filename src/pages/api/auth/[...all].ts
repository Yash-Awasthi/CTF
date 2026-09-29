/**
 * Better Auth catch-all route handler for CTF.
 *
 * Handles all /api/auth/* routes:
 * - POST /api/auth/sign-up/email — Register new participant
 * - POST /api/auth/sign-in/email — Login with email/password
 * - GET /api/auth/get-session — Get current session
 * - POST /api/auth/sign-out — Logout
 * - POST /api/auth/forget-password — Request password reset
 * - POST /api/auth/reset-password — Reset password with token
 *
 * See: https://better-auth.com/docs
 */
import type { APIRoute } from 'astro';
import { getAuth } from '../../../lib/auth/better-auth';

export const prerender = false;

/**
 * Better Auth requires handling all HTTP methods on the catch-all route.
 * The auth instance handles routing internally based on the path.
 */
async function handleAuth(request: Request): Promise<Response> {
  const auth = getAuth();

  // Better Auth handler expects the full request
  // It routes internally based on URL path and method
  return auth.handler(request);
}

export const GET: APIRoute = async ({ request }) => handleAuth(request);
export const POST: APIRoute = async ({ request }) => handleAuth(request);
export const PUT: APIRoute = async ({ request }) => handleAuth(request);
export const PATCH: APIRoute = async ({ request }) => handleAuth(request);
export const DELETE: APIRoute = async ({ request }) => handleAuth(request);
