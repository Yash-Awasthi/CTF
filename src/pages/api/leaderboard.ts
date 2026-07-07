import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { resolveEventBySlug } from '../../lib/event/resolve';
import { getPublicLeaderboard, LeaderboardNotPublicError } from '../../lib/leaderboard';

export const prerender = false;

function json(b: unknown, s: number) {
	return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
}

/**
 * Public leaderboard — served ONLY when the event is RESULTS_PUBLISHED. Before
 * that it 403s (never leaks standings during the competition). Unmasked rolls.
 */
export const GET: APIRoute = async ({ url }) => {
	const slug = url.searchParams.get('event');
	if (!slug) return json({ error: 'event_required' }, 400);
	const db = createDb(getEnv().DB);
	const event = await resolveEventBySlug(db, slug);
	if (!event) return json({ error: 'event_not_found' }, 404);
	try {
		const leaderboard = await getPublicLeaderboard(db, event);
		return json({ eventSlug: event.slug, state: event.state, leaderboard }, 200);
	} catch (e) {
		if (e instanceof LeaderboardNotPublicError) return json({ error: 'not_published' }, 403);
		throw e;
	}
};
