import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { listAnnouncements } from '../../lib/admin';

export const prerender = false;

/** Authenticated, event-scoped announcements for the participant's own event. */
export const GET: APIRoute = async ({ locals }) => {
	const auth = locals.auth;
	if (!auth) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { 'content-type': 'application/json' } });
	const db = createDb(getEnv().DB);
	const rows = await listAnnouncements(db, auth.event.id);
	return new Response(JSON.stringify({ announcements: rows }), { status: 200, headers: { 'content-type': 'application/json' } });
};
