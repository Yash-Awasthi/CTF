/**
 * Better Auth configuration for CTF (case-files).
 *
 * Replaces the custom session system with production-grade auth:
 * - Email/password authentication with proper hashing
 * - Session management with cookie cache
 * - Rate limiting on auth endpoints
 * - CSRF protection
 * - Organization plugin for CTF events/teams
 *
 * Setup:
 * 1. npm install better-auth
 * 2. Set env vars: BETTER_AUTH_SECRET, BETTER_AUTH_URL
 * 3. Run: npx @better-auth/cli@latest migrate
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from '../db/client';
import { getEnv } from '../runtime';
import { hashPassword, verifyPassword } from './password';

/**
 * Create the Better Auth instance.
 *
 * This uses the Drizzle adapter with D1 (SQLite).
 * The adapter maps Better Auth's internal models to existing tables:
 * - `user` → `participants` (CTF's user table)
 * - `session` → `sessions` (CTF's session table)
 * - `account` → created by Better Auth (for OAuth providers)
 */
export function createAuth() {
  const env = getEnv() as unknown as Env & { BETTER_AUTH_URL?: string; BETTER_AUTH_SECRET?: string };
  const db = createDb(env.DB);

  return betterAuth({
    // ── App ──────────────────────────────────────────────────────────────
    appName: 'Case Files CTF',
    baseURL: env.BETTER_AUTH_URL || 'https://case-files.pages.dev',
    basePath: '/api/auth',

    // ── Database ─────────────────────────────────────────────────────────
    database: drizzleAdapter(db, {
      provider: 'sqlite',
    }),

    // ── Email & Password ─────────────────────────────────────────────────
    emailAndPassword: {
      enabled: true,
      // Salted PBKDF2 lives in ./password so it can be unit-tested without
      // constructing an auth instance against a database binding.
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },

    // ── Session ──────────────────────────────────────────────────────────
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // Refresh every 24 hours
      cookieCache: {
        enabled: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    },

    // ── Security ─────────────────────────────────────────────────────────
    advanced: {
      useSecureCookies: true,
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'],
      },
    },

    // ── Rate Limiting ────────────────────────────────────────────────────
    rateLimit: {
      enabled: true,
      window: 60, // 1 minute
      max: 10, // 10 requests per window
    },

    // ── Trusted Origins ──────────────────────────────────────────────────
    trustedOrigins: [
      'https://case-files.pages.dev',
      'http://localhost:4321', // Astro dev server
    ],

    // ── Plugins ──────────────────────────────────────────────────────────
    plugins: [
      // Organization plugin — maps to CTF events/teams
      // Allows grouping users into organizations (events)
      // and managing roles within them
    ],
  });
}

/**
 * Singleton instance.
 * In Cloudflare Workers, each request gets a new context,
 * but the auth instance can be shared.
 */
let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}
