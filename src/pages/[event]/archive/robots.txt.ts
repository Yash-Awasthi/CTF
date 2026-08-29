/**
 * GET /{event}/archive/robots.txt
 *
 * Serves the personalized robots.txt for Q5 — Pembridge Local Heritage site.
 *
 * Security:
 *   - Requires authenticated participant for this event.
 *   - Requires Q5 to be unlocked (currentChallenge >= 5).
 *   - The disallowed path is participant-specific (archivePath from Q5 publicData),
 *     so sharing this URL with another participant reveals nothing useful to them
 *     unless they also know their own archivePath.
 *
 * Q29 note: the BPHA- prefix in the Disallow path is the locked Q5 secondary
 * anomaly. The inline comment provides the in-world explanation (digitisation
 * project prefix). Do not remove the comment or the prefix.
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { canAccessCompetition } from '../../../lib/event/access';
import { getPublicChallengeData, getEventRoster, canAccessChallenge } from '../../../lib/challenges';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
	const auth = locals.auth;

	// ── Auth ──────────────────────────────────────────────────────────────────
	if (!auth || auth.event.slug !== params.event) {
		return new Response('Unauthorized', { status: 401 });
	}

	// ── Event state ───────────────────────────────────────────────────────────
	const db = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	if (!canAccessCompetition(event, now)) {
		return new Response('Competition not active', { status: 403 });
	}

	// ── Progression gate: Q5 must be unlocked ─────────────────────────────────
	if (!canAccessChallenge(auth.participant, 5)) {
		return new Response('Not found', { status: 404 });
	}

	// ── Derive Q5 public data to get this participant's archive path ───────────
	const roster = await getEventRoster(db, event.id);
	const view = await getPublicChallengeData(
		{ env: getEnv(), event, rollNumber: auth.participant.rollNumber, roster },
		5,
	);

	const pub = view.publicData as { archivePath: string };
	const archivePath = pub.archivePath; // e.g. "BPHA-1847-workshop"

	// ── Serve robots.txt ──────────────────────────────────────────────────────
	// The BPHA- prefix is the Q5 Q29 anomaly. In-world: Bremwick-Pembridge
	// Heritage Archive digitisation project (c. 2004). The comment below is
	// intentionally included — it is the in-world explanation participants find.
	const body = [
		'User-agent: *',
		'Disallow: /cgi-bin/',
		'Disallow: /drafts/',
		`Disallow: /${archivePath}/`,
		'',
		'# BPHA: Bremwick-Pembridge Heritage Archive digitisation project (2004)',
		'# Archive paths with BPHA- prefix are managed by the digitisation system.',
		'# Sub-collections pending classification review are excluded from crawling.',
	].join('\n');

	return new Response(body, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	});
};
