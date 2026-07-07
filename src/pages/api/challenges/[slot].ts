import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { canAccessCompetition } from '../../../lib/event/access';
import {
	getPublicChallengeData,
	getEventRoster,
	getChallengeAccessStatus,
	parseSlot,
	InvalidSlotError,
} from '../../../lib/challenges';

export const prerender = false;

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

/**
 * Authenticated PUBLIC challenge data. Enforces the SAME chain as the page
 * (auth → LIVE event → progression → public-data boundary) via the shared
 * engine service — no duplicated logic, no private data ever serialized.
 */
export const GET: APIRoute = async ({ locals, params }) => {
	const auth = locals.auth;
	if (!auth) return json({ error: 'unauthenticated' }, 401);

	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	if (!canAccessCompetition(event, now)) {
		return json({ error: 'event_not_live' }, 403);
	}

	let slot: number;
	try {
		slot = parseSlot(params.slot);
	} catch (e) {
		if (e instanceof InvalidSlotError) return json({ error: 'not_found' }, 404);
		throw e;
	}

	// Progression: no access to a locked future slot via the API either.
	if (getChallengeAccessStatus(auth.participant, slot) === 'locked') {
		return json({ error: 'locked' }, 403);
	}

	const roster = await getEventRoster(db, event.id);
	try {
		const view = await getPublicChallengeData(
			{ env: getEnv(), event, rollNumber: auth.participant.rollNumber, roster },
			slot,
		);
		return json(view, 200);
	} catch {
		return json({ error: 'unavailable' }, 500);
	}
};
