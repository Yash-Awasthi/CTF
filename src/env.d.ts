/// <reference types="astro/client" />
// Bindings and secrets are typed by `wrangler types` (worker-configuration.d.ts).

declare namespace App {
  interface Locals {
    /** Resolved once per request by the middleware; null when unauthenticated. */
    auth: import('./lib/auth/types').AuthContext | null;
  }
}
