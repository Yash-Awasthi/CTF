/** Opaque session cookie name. Holds only the raw token, nothing else. */
export const SESSION_COOKIE = 'cf_session';

/** Session lifetime. No inactivity timeout — valid until logout/replacement/expiry. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12h

/** Session token entropy: 32 bytes = 256 bits. */
export const SESSION_TOKEN_BYTES = 32;

// Login-allowed states now live in src/lib/event/constants.ts (single source);
// use canParticipantLogin()/isLoginAllowed().

/** Login rate-limit policy: >= MAX failures within WINDOW seconds → cooldown. */
export const RATE_LIMIT_MAX_FAILURES = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 5 * 60; // 5 min

/**
 * Submission/hint throttle. Lower ceiling than login: a correct answer is a
 * single guess, so a legitimate participant never accumulates failures, while
 * an attacker guessing the answer does. Counts failed attempts only, matching
 * the login policy's failure-count semantics.
 */
export const SUBMIT_RATE_LIMIT_MAX_FAILURES = 5;
export const SUBMIT_RATE_LIMIT_WINDOW_SECONDS = 60; // 1 min
