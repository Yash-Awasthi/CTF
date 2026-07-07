import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { ensureCurrentEventState } from '../../lib/event/state';
import { canSubmit } from '../../lib/event/access';
import { challenges } from '../../lib/db/schema';
import { hintSchema } from '../../lib/validation/submission';
import { getChallengeAccessStatus } from '../../lib/challenges';
import { HintError, revealHint } from '../../lib/hints';

export const prerender = false;

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

/**
 * POST /api/hint — reveal a hint (in order) for the participant's CURRENT
 * challenge. Server derives everything; hint content is returned only after a
 * successful, persisted reveal. Locked/future challenges and non-LIVE events are
 * rejected. Hint reveal permanently sets that challenge's scoring hint_factor to
 * 0.5 (read from D1 at solve time).
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const auth = locals.auth;
	if (!auth) return json({ error: 'unauthenticated' }, 401);

	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	if (!canSubmit(event, now)) return json({ error: 'event_not_live' }, 403);

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'invalid_input' }, 400);
	}
	const parsed = hintSchema.safeParse(payload);
	if (!parsed.success) return json({ error: 'invalid_input' }, 400);
	const { slot, hintNumber } = parsed.data;

	// Hints only for the actively-played (current) challenge — never a locked
	// future slot, and not a past solved one.
	const status = getChallengeAccessStatus(auth.participant, slot);
	if (status !== 'current') return json({ error: 'locked' }, 403);

	const challenge = await db
		.select({ id: challenges.id })
		.from(challenges)
		.where(and(eq(challenges.eventId, event.id), eq(challenges.slot, slot)))
		.get();
	if (!challenge) return json({ error: 'not_found' }, 404);

	try {
		const reveal = await revealHint(db, {
			eventId: event.id,
			participantId: auth.participant.id,
			challengeId: challenge.id,
			slot,
			hintNumber,
		});
		return json(reveal, 200);
	} catch (e) {
		if (e instanceof HintError) {
			const code = e.code === 'out_of_order' ? 409 : 400;
			return json({ error: e.code }, code);
		}
		throw e;
	}
};
