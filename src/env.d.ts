/**
 * Type-safe environment variables for CTF.
 *
 * Defines the schema for all env vars used by the app.
 * See: https://docs.astro.build/guides/environment-variables/
 */
/// <reference types="astro/client" />

interface Env {
  // Database
  DB: D1Database;

  // Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;

  // Assets
  ASSETS: Fetcher;
  BUCKET: R2Bucket;

  // Secrets
  EVENT_SECRET: string;
  RATE_LIMIT_SECRET: string;
  ADMIN_SECRET: string;

  // Email
  EMAIL: any;

  // Vars
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  ACCESS_ADMIN_EMAILS?: string;
}

declare namespace App {
  interface Locals {
    /** Resolved once per request by the middleware; null when unauthenticated. */
    auth: import('./lib/auth/types').AuthContext | null;
  }
}
