/**
 * GET /case/memo/daniel-reyes.bak
 *
 * Q15 artifact — the editor backup of the memo, left beside it when Reyes saved
 * over his first draft. The draft dates his first meeting with Vale to a day in
 * 2001, attributed per participant: the Q15 answer. Gone once the memo changes (Q19).
 */
import type { APIRoute } from 'astro';
import { gateArtifact } from '../../../lib/challenges/artifact-gate';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { generateChallengeForParticipant, getEventRoster } from '../../../lib/challenges';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
	const denied = await gateArtifact(locals.auth, 15);
	if (denied) return denied;
	const auth = locals.auth!;
	if (auth.participant.currentChallenge >= 19) return new Response('Not Found', { status: 404 });
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event: auth.event, rollNumber: auth.participant.rollNumber, roster: await getEventRoster(createDb(getEnv().DB), auth.event.id) },
		15,
	);
	const met = new Date(`${(instance.privateData as { answer: string }).answer}T12:00:00Z`)
		.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

	const draft = [
		'DRAFT 1 — do not publish',
		'',
		`I have known Silas Vale since ${met}, through private auction circles.`,
		'We met at the Caldwell sale that day. He trusted me with access to',
		'the collection long before his death.',
		'',
		'[REVISION NOTE: change to "engaged by solicitors" version — too much detail]',
		'',
	].join('\n');

	return new Response(draft, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' },
	});
};
