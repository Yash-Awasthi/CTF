import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { ensureCurrentEventState } from '../../lib/event/state';
import { canSubmit } from '../../lib/event/access';
import { submitSchema } from '../../lib/validation/submission';
import { processSubmission } from '../../lib/submission';

export const prerender = false;

function json(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

/**
 * POST /api/submit — the deferred submission endpoint. Thin shell: auth →
 * authoritative LIVE state → Zod → processSubmission (Phase 5 validate + Phase 6
 * score + progression). Responses expose ONLY safe fields — never the correct
 * answer, private challenge data, seeds, or ownership maps.
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const auth = locals.auth;
	if (!auth) return json({ error: 'unauthenticated' }, 401);

	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	// Submissions accepted only while LIVE (authoritative server timing).
	if (!canSubmit(event, now)) return json({ error: 'event_not_live' }, 403);

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'invalid_input' }, 400);
	}
	const parsed = submitSchema.safeParse(payload);
	if (!parsed.success) return json({ error: 'invalid_input' }, 400);

	const outcome = await processSubmission(db, {
		env: getEnv(),
		event,
		participant: auth.participant,
		slot: parsed.data.slot,
		rawAnswer: parsed.data.answer,
		now,
	});

	switch (outcome.outcome) {
		case 'eliminated':
			return json({ error: 'eliminated' }, 403);
		case 'not_found':
			return json({ error: 'not_found' }, 404);
		case 'locked':
			return json({ error: 'locked' }, 403);
		case 'already_solved':
			return json({ correct: true, alreadySolved: true }, 200);
		case 'incorrect':
			return json({ correct: false }, 200);
		case 'correct':
			return json(
				{
					correct: true,
					finalScore: outcome.finalScore,
					timeFactor: outcome.timeFactor,
					hintFactor: outcome.hintFactor,
					hintUsed: outcome.hintUsed,
					currentChallenge: outcome.currentChallenge,
					completed: outcome.completed,
					firstBlood: outcome.firstBlood,
				},
				200,
			);
	}
};
