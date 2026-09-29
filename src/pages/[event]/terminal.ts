/**
 * POST /{event}/terminal  { command }
 *
 * Q29's correlation terminal. VERIFY checks a reconstructed doctrine and, when it
 * matches the Ledger margin, shows the initials it is signed with.
 */
import type { APIRoute } from 'astro';
import { gateArtifact } from '../../lib/challenges/artifact-gate';
import { isDoctrine } from '../../../challenges/29/index';

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
	return json({
		output: [
			'MATCH — LEDGER MARGIN, ALL CYCLES.',
			'',
			'  PEOPLE CHANGE. NAMES REMAIN.',
			'  RECORDS CHANGE. ROLES REMAIN.',
			'  THE INVESTIGATION MUST CONTINUE.',
			'',
			'  — initialled  T. C.',
		].join('\n'),
	});
};
