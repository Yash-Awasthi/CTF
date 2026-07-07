import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { readUpdates } from '../../../lib/sse';

export const prerender = false;

/** Polling fallback for live updates (authoritative D1 snapshot since cursors). */
export const GET: APIRoute = async ({ locals, url }) => {
	const auth = locals.auth;
	if (!auth) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401, headers: { 'content-type': 'application/json' } });
	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);
	const fb = Number(url.searchParams.get('fb') ?? 0) || 0;
	const ann = Number(url.searchParams.get('ann') ?? 0) || 0;
	const snap = await readUpdates(db, event, { fb, ann }, now);
	return new Response(JSON.stringify(snap), { status: 200, headers: { 'content-type': 'application/json' } });
};
