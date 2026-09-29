/**
 * POST /{event}/ledger  { cells: { [blankId]: string } }
 *
 * Q28's Ledger. Checks the player's rebuilt role table row by row (never cell by
 * cell) and, once every row is right, prints the current cycle with the
 * reference for its open role — the Q28 answer.
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db/client';
import { getEnv } from '../../lib/runtime';
import { gateArtifact } from '../../lib/challenges/artifact-gate';
import { generateChallengeForParticipant, getEventRoster } from '../../lib/challenges';
import { getCodename } from '../../../challenges/shared/codenames';
import { checkLedger, type Q28Public, type Q28Private } from '../../../challenges/28/index';

export const prerender = false;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});

export const POST: APIRoute = async ({ params, request, locals }) => {
	const auth = locals.auth;
	if (!auth || auth.event.slug !== params.event) return json({ error: 'unauthenticated' }, 401);
	const denied = await gateArtifact(auth, 28);
	if (denied) return json({ error: 'locked' }, denied.status);

	const body = (await request.json().catch(() => null)) as { cells?: unknown } | null;
	const cells = body?.cells;
	if (!cells || typeof cells !== 'object') return json({ error: 'invalid_input' }, 400);

	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event: auth.event, rollNumber: auth.participant.rollNumber, roster: await getEventRoster(createDb(getEnv().DB), auth.event.id) },
		28,
	);
	const { rows } = instance.publicData as Q28Public;
	const { expected, answer } = instance.privateData as Q28Private;
	const given = cells as Record<string, unknown>;

	const status = checkLedger(rows, expected, given);
	if (!status.every(Boolean)) return json({ rows: status, complete: false });

	return json({
		rows: status,
		complete: true,
		current: {
			cycle: '6',
			years: '2026 —',
			cells: ['BLACKWOOD ARCHIVE', '[SEALED]', `${getCodename(auth.participant.rollNumber)} (INV-${auth.participant.rollNumber})`, 'DANIEL REYES (current instance, unmet)', `PENDING — ref ${answer}`],
		},
	});
};
