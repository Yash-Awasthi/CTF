/** Opaque session cookie name. Holds only the raw token, nothing else. */
export const SESSION_COOKIE = 'cf_session';

/** Session lifetime. No inactivity timeout — valid until logout/replacement/expiry. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h

/** Session token entropy: 32 bytes = 256 bits. */
export const SESSION_TOKEN_BYTES = 32;

// Login-allowed states now live in src/lib/event/constants.ts (single source);
// use canParticipantLogin()/isLoginAllowed().

/**
 * Throttling runs on the Workers Rate Limiting bindings in wrangler.jsonc, which
 * count attempts per key over this period. Keep it equal to their `period`.
 */
export const RATE_LIMIT_PERIOD_SECONDS = 60;

/** Failed attempts are still counted in D1 per window, for the audit trail only. */
export const FAILURE_AUDIT_WINDOW_SECONDS = 5 * 60; // 5 min
