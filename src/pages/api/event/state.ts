import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { getEventTiming } from '../../../lib/event/timer';

export const prerender = false;

/**
 * Authenticated authoritative event state + timing. Performs the canonical lazy
 * expiry refresh before deriving timing. Never exposes secret_version or other
 * internal metadata. Later SSE/polling can reuse the same service.
 */
export const GET: APIRoute = async ({ locals }) => {
	const auth = locals.auth;
	if (!auth) {
		return new Response(JSON.stringify({ error: 'unauthenticated' }), {
			status: 401,
			headers: { 'content-type': 'application/json' },
		});
	}

	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);
	const timing = getEventTiming(event, now);

	return new Response(
		JSON.stringify({ eventSlug: event.slug, ...timing }),
		{ status: 200, headers: { 'content-type': 'application/json' } },
	);
};
