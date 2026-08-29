/**
 * POST /{event}/auction/search
 *
 * Sovereign Auction House — Legacy Catalogue System search endpoint for Q8.
 *
 * Simulates a SQL-injectable search on the legacy auction catalogue. Normal
 * queries return the four publicly visible lots around lot 47 (44, 45, 46, 48).
 * A single-quote probe returns a SQL error revealing the query structure.
 * A bypass injection (any `' OR …` pattern) surfaces the suppressed Lot 47
 * record — including the participant's attribution-assigned origin phrase.
 *
 * Security:
 *   - Requires authenticated participant for this event.
 *   - Requires Q8 to be unlocked (currentChallenge >= 8).
 *   - Returns 403 for locked/unauthenticated requests.
 *   - The Lot 47 origin phrase (answer) is only returned when injection is
 *     performed; it is NEVER present in the pre-rendered page HTML.
 *   - No private data is returned for requests that do not trigger injection.
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

export const prerender = false;

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
	});
}

// ── Injection detection ───────────────────────────────────────────────────────

type QueryType = 'clean' | 'syntax_error' | 'bypass';

/**
 * Classify the query string.
 *
 * clean        → normal input, return filtered lot list (no lot 47)
 * syntax_error → single quote detected, return a SQL error fragment revealing
 *                the query structure (nudges toward full bypass)
 * bypass       → `' OR …` pattern detected, return the suppressed Lot 47 record
 */
function classifyQuery(raw: string): QueryType {
	const q = raw.toLowerCase();
	if (!q.includes("'")) return 'clean';
	// Any `' OR` combination (with or without trailing condition) reveals lot 47.
	// This is intentionally permissive for beginner fairness.
	if (q.includes("' or") || q.includes("'or")) return 'bypass';
	// Quote present but no bypass condition → syntax error
	return 'syntax_error';
}

// ── Visible public lots (never includes lot 47) ───────────────────────────────

interface PublicLot {
	id: number;
	title: string;
	category: string;
	origin: string;
	status: string;
}

const PUBLIC_LOTS: readonly PublicLot[] = [
	{
		id: 44,
		title: 'Oak Writing Table, c.1890',
		category: 'Furniture',
		origin: 'ACQUIRED 1912, VALE ESTATE PURCHASE',
		status: 'SOLD',
	},
	{
		id: 45,
		title: 'Silver Candelabra (pair)',
		category: 'Silverware',
		origin: 'ACQUIRED 1928, PRIVATE COLLECTION',
		status: 'SOLD',
	},
	{
		id: 46,
		title: 'Oriental Rug, Persian (19th C.)',
		category: 'Textiles',
		origin: 'ACQUIRED 1956, ESTATE CLEARANCE',
		status: 'SOLD',
	},
	{
		id: 48,
		title: "Ceramic Vases (set of three)",
		category: 'Ceramics',
		origin: 'ACQUIRED 1988, PRIVATE PURCHASE',
		status: 'SOLD',
	},
	{
		id: 49,
		title: 'Travel Trunk, leather, monogrammed',
		category: 'Personal effects',
		origin: 'ACQUIRED 1991, CHARITABLE DONATION',
		status: 'WITHDRAWN',
	},
];

// ── Handler ───────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ params, request, locals }) => {
	const slug = params.event!;
	const auth = locals.auth;

	if (!auth || auth.event.slug !== slug) {
		return json({ error: 'unauthenticated' }, 401);
	}

	const db  = createDb(getEnv().DB);
	const now = new Date();
	const event = await ensureCurrentEventState(db, auth.event, now);

	if (!canAccessCompetition(event, now)) {
		return json({ error: 'event_not_live' }, 403);
	}

	// Q8 must be unlocked (currentChallenge >= 8)
	if (!canAccessChallenge(auth.participant, 8)) {
		return json({ error: 'locked' }, 403);
	}

	// Parse body
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'invalid_input' }, 400);
	}

	if (
		typeof payload !== 'object' ||
		payload === null ||
		typeof (payload as Record<string, unknown>).query !== 'string'
	) {
		return json({ error: 'invalid_input' }, 400);
	}

	const rawQuery = ((payload as Record<string, unknown>).query as string).slice(0, 200);
	const kind     = classifyQuery(rawQuery);

	// ── Clean query: return public lots (lot 47 absent) ──────────────────────

	if (kind === 'clean') {
		return json({ type: 'clean', lots: PUBLIC_LOTS });
	}

	// ── Syntax error: single quote — reveal query structure ───────────────────

	if (kind === 'syntax_error') {
		return json({
			type: 'syntax_error',
			error: [
				"ERROR 1064 (42000): You have an error in your SQL syntax.",
				"",
				"Near: SELECT * FROM lots WHERE (public=1) AND (lot_id LIKE '%",
				rawQuery.slice(0, 40).replace(/</g, '&lt;').replace(/>/g, '&gt;'),
				"'%' OR title LIKE '%...)",
				"",
				"Query aborted.",
			].join('\n'),
		});
	}

	// ── Bypass: serve suppressed Lot 47 with participant's origin phrase ──────

	const roster = await getEventRoster(db, event.id);
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event, rollNumber: auth.participant.rollNumber, roster },
		8,
	);
	const originPhrase = (instance.privateData as { answer: string }).answer;

	return json({
		type    : 'bypass',
		injected: {
			lot_id : 47,
			title  : 'Untitled Figure (Commission)',
			origin : originPhrase,
			notes  : '[SUPPRESSED \u2014 see estate solicitor reference file]',
		},
	});
};
