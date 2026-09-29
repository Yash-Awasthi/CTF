import { defineMiddleware } from 'astro:middleware';
import { createDb } from '../lib/db/client';
import { getEnv } from '../lib/runtime';
import { getAuthenticatedParticipant } from '../lib/auth/authenticate';
import { getSecurityHeaders } from '../lib/security/headers';

/**
 * Resolves the request's auth context ONCE and exposes it as `locals.auth`
 * (null if unauthenticated). Pages redirect to login; API routes return 401 —
 * each enforces using `locals.auth`, so auth queries are never duplicated.
 *
 * Security headers are applied here because the app renders on demand: Cloudflare's
 * `_headers` file only decorates static assets, so an SSR document would never
 * receive them from that mechanism.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.auth = null;

	const db = createDb(getEnv().DB);
	context.locals.auth = await getAuthenticatedParticipant(context.cookies, db);

	const response = await next();

	for (const [key, value] of Object.entries(getSecurityHeaders())) {
		response.headers.set(key, value);
	}

	return response;
});
