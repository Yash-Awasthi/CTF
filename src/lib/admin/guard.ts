/**
 * Shared admin-route guard. Enforces admin cookie auth, (for mutations)
 * same-origin CSRF defence, and resolves the target event. Returns either a
 * ready-to-use context or a Response to short-circuit the route.
 */
import type { AstroCookies } from 'astro';
import { createDb, type DB } from '../db/client';
import { getEnv } from '../runtime';
import { resolveEventBySlug } from '../event/resolve';
import type { EventRow } from '../auth/types';
import { isAdmin, isSameOrigin } from './auth';

export function adminJson(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

export interface AdminContext {
	env: Env;
	db: DB;
	event: EventRow;
}

/** Guard an admin route. `mutation` adds the same-origin (CSRF) requirement. */
export async function guardAdmin(
	request: Request,
	cookies: AstroCookies,
	eventSlug: string | undefined,
	opts: { mutation: boolean },
): Promise<AdminContext | Response> {
	const env = getEnv();
	const db = createDb(env.DB);
	if (!(await isAdmin(cookies, db))) return adminJson({ error: 'unauthorized' }, 401);
	if (opts.mutation && !isSameOrigin(request)) {
		return adminJson({ error: 'bad_origin' }, 403);
	}
	if (!eventSlug) return adminJson({ error: 'event_required' }, 400);

	const event = await resolveEventBySlug(db, eventSlug);
	if (!event) return adminJson({ error: 'event_not_found' }, 404);
	return { env, db, event };
}
