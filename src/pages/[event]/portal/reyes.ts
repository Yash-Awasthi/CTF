/**
 * POST /{event}/portal/reyes  { password }
 *
 * Daniel Reyes's private archive portal for Q12. The password is the reference
 * code from his contact message; a correct one returns this participant's
 * archive listing, which contains the Q12 answer filename.
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { canAccessCompetition } from '../../../lib/event/access';
import {
	generateChallengeForParticipant,
	getEventRoster,
	canAccessChallenge,
} from '../../../lib/challenges';
import type { Q12Private } from '../../../../challenges/12/index';

export const prerender = false;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});
}

export const POST: APIRoute = async ({ params, request, locals }) => {
	const slug = params.event!;
	const auth = locals.auth;
	if (!auth || auth.event.slug !== slug) return json({ error: 'unauthenticated' }, 401);

	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);
	if (!canAccessCompetition(event, now)) return json({ error: 'event_not_live' }, 403);
	if (!canAccessChallenge(auth.participant, 12)) return json({ error: 'locked' }, 403);

	const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
	if (typeof body?.password !== 'string') return json({ error: 'invalid_input' }, 400);

	const roster = await getEventRoster(db, event.id);
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event, rollNumber: auth.participant.rollNumber, roster },
		12,
	);
	const priv = instance.privateData as Q12Private;
	if (body.password.trim().toUpperCase() !== priv.credential) {
		return json({ ok: false, message: 'ACCESS DENIED — invalid credentials.' });
	}
	return json({ ok: true, directory: 'daniel-reyes-private-archive/', listing: priv.listing });
};
