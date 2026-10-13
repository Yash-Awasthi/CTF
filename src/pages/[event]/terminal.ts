/**
 * POST /{event}/terminal  { command }
 *
 * Q29's correlation terminal. VERIFY checks a reconstructed doctrine and, when it
 * matches the Ledger margin, shows the initials it is signed with and this player's
 * countersign, enciphered under the keeper's name.
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { gateArtifact } from '../../lib/challenges/artifact-gate';
import { generateChallengeForParticipant, getEventRoster } from '../../lib/challenges';
import { KEEPER, isDoctrine, vigenere, type Q29Private } from '../../../challenges/29/index';

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

export const POST: APIRoute = async ({ params, request, locals }) => {
	const auth = locals.auth;
	if (!auth || auth.event.slug !== params.event) return json({ error: 'unauthenticated' }, 401);
	const denied = await gateArtifact(auth, 29);
	if (denied) return json({ error: 'locked' }, denied.status);

	const body = (await request.json().catch(() => null)) as { command?: unknown } | null;
	const command = typeof body?.command === 'string' ? body.command.trim().slice(0, 400) : '';
	const match = /^verify\s+([\s\S]+)$/i.exec(command);
	if (!match) return json({ output: 'UNKNOWN COMMAND. Available: VERIFY <doctrine>' });
	if (!isDoctrine(match[1])) return json({ output: 'NO MATCH IN THE LEDGER MARGIN.' });
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event: auth.event, rollNumber: auth.participant.rollNumber, roster: await getEventRoster(createDb(getEnv().DB), auth.event.id) },
		29,
	);
	const countersign = vigenere((instance.privateData as Q29Private).answer, KEEPER);
	return json({
		output: [
			'MATCH — LEDGER MARGIN, ALL CYCLES.',
			'',
			'  PEOPLE CHANGE. NAMES REMAIN.',
			'  RECORDS CHANGE. ROLES REMAIN.',
			'  THE INVESTIGATION MUST CONTINUE.',
			'',
			'  — initialled  T. C.',
			`  — countersign, keyed to the keeper's full name:  ${countersign}`,
		].join('\n'),
	});
};
