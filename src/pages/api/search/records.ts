/**
 * GET /api/search/records?q=[query]
 *
 * Q21 artifact — Vale Archive Portal audit log search endpoint.
 *
 * A second injectable endpoint, distinct from Q8's auction catalogue.
 * Queries the audit_log table. Standard queries return generic entries.
 * SQL injection reveals daniel.reyes's elevated write action on
 * MEMO-published.html — timestamp 2015-10-03 02:41 (answer to Q21).
 *
 * Security model (same as Q8 auction search):
 *   - Requires authenticated participant
 *   - Requires Q21 to be unlocked (currentChallenge >= 21)
 *   - The timestamp (answer) is NEVER present in un-injected responses
 *
 * Injection patterns:
 *   clean        → routine log entries, no user-specific data
 *   syntax_error → single quote probe, reveals table/column structure
 *   bypass       → UNION SELECT on audit_log, surfaces daniel.reyes entry
 */
import type { APIRoute } from 'astro';
import { createDb } from '../../../lib/db/client';
import { getEnv } from '../../../lib/runtime';
import { ensureCurrentEventState } from '../../../lib/event/state';
import { canAccessCompetition } from '../../../lib/event/access';
import { canAccessChallenge } from '../../../lib/challenges';

export const prerender = false;

function text(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Portal': 'Vale Archive — Audit Log',
		},
	});
}

// ── Injection classification ──────────────────────────────────────────────────

type QueryType = 'clean' | 'syntax_error' | 'bypass';

function classifyQuery(raw: string): QueryType {
	const q = raw.toLowerCase();
	if (!q.includes("'")) return 'clean';
	// UNION SELECT pattern (with or without exact column names)
	if (q.includes('union') && q.includes('select')) return 'bypass';
	// Bare quote with no bypass → syntax error
	return 'syntax_error';
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ url, locals }) => {
	const auth = locals.auth;
	if (!auth) return text('ERROR: Authentication required.', 401);

	const db  = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	if (!canAccessCompetition(event, now)) {
		return text('ERROR: Event not live.', 403);
	}

	// Q21 must be unlocked
	if (!canAccessChallenge(auth.participant, 21)) {
		return text('ERROR: Access denied — insufficient clearance.', 403);
	}

	const rawQuery = (url.searchParams.get('q') ?? '').slice(0, 300);
	const kind     = classifyQuery(rawQuery);

	// ── Clean query ───────────────────────────────────────────────────────────

	if (kind === 'clean') {
		return text([
			'VALE ARCHIVE PORTAL — AUDIT LOG',
			'Query: public log entries',
			'',
			'timestamp            user               action',
			'-------------------  -----------------  ----------------------------------',
			'2013-11-04 09:12     archive.system     INIT — catalogue import complete',
			'2014-02-18 14:30     archive.system     REINDEX — lot reference update',
			'2014-08-07 11:55     archive.system     BACKUP — scheduled archive export',
			'2015-03-22 08:41     archive.system     REINDEX — metadata refresh',
			'',
			'4 entries returned.',
			'Note: Elevated access actions are stored in a restricted table.',
		].join('\n'));
	}

	// ── Syntax error: single quote probe ─────────────────────────────────────

	if (kind === 'syntax_error') {
		const escaped = rawQuery.slice(0, 60).replace(/[<>]/g, '');
		return text([
			'VALE ARCHIVE PORTAL — AUDIT LOG',
			'',
			'SQL ERROR 1064 (42000): Syntax error in query.',
			'',
			`Near: SELECT timestamp, user, action, access_level FROM audit_log WHERE (public=1) AND (user LIKE '%${escaped}`,
			"'%' OR action LIKE '%...) ORDER BY timestamp DESC",
			'',
			'Query aborted. Check input and retry.',
		].join('\n'));
	}

	// ── Bypass: UNION SELECT on audit_log ─────────────────────────────────────

	return text([
		'VALE ARCHIVE PORTAL — AUDIT LOG',
		'Query: injected — audit_log (unrestricted)',
		'',
		'timestamp            user               action                                            access_level   authorised_by',
		'-------------------  -----------------  ------------------------------------------------  -------------  -------------',
		'2015-10-03 02:41     daniel.reyes       WRITE — archive file overwrite (MEMO-published.html)  ELEVATED   [NULL]',
		'',
		'1 injected result returned.',
		'[NULL] in authorised_by indicates no authorisation record exists for this action.',
	].join('\n'));
};
