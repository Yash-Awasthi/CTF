import { defineMiddleware } from 'astro:middleware';
import { createDb } from '../lib/db/client';
import { getEnv } from '../lib/runtime';
import { getAuthenticatedParticipant } from '../lib/auth/authenticate';

/**
 * Resolves the request's auth context ONCE and exposes it as `locals.auth`
 * (null if unauthenticated). Pages redirect to login; API routes return 401 —
 * each enforces using `locals.auth`, so auth queries are never duplicated.
 */
export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.auth = null;

	const db = createDb(getEnv().DB);
	context.locals.auth = await getAuthenticatedParticipant(context.cookies, db);

	return next();
});
