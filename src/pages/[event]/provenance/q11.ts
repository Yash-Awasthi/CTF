/**
 * GET /{event}/provenance/q11?clearance={value}
 *
 * Vale Collection Provenance Verification System — Doll #6 record endpoint.
 *
 * This endpoint intentionally trusts the client-supplied `clearance` query
 * parameter to determine which provenance records to return. This is an
 * in-fiction vulnerability: the server correctly enforces authentication and
 * progression but incorrectly delegates record-scope selection to a value the
 * client can freely modify.
 *
 * Designed for Q11 ("VERIFIED"). The participant discovers the `prov_clearance`
 * localStorage key, changes it from "standard" to "full", and re-queries this
 * endpoint to reveal the suppressed intermediate owner.
 *
 * Security isolation (intentional design constraints):
 *   - Requires a valid authenticated participant session (real platform auth).
 *   - Requires Q11 to be accessible (currentChallenge >= 11).
 *   - The `clearance` parameter ONLY controls which fictional provenance records
 *     are returned. It cannot bypass authentication, progression, or access any
 *     real platform data.
 *   - `clearance=standard` → partial chain, no suppressed owner, VERIFIED status.
 *   - `clearance=full`     → complete chain including suppressed owner (from
 *     privateData via generateChallengeForParticipant), DISCREPANCY status.
 *   - The suppressed owner name is NEVER returned for standard-clearance requests.
 *   - No participant seeds, EVENT_SECRET, scores, or other challenge data are
 *     exposed through this endpoint.
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
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
		},
	});
}

// ── Static provenance records ─────────────────────────────────────────────────

interface ProvenanceEntry {
	id: string;
	owner: string;
	period: string;
	transferType: string;
	verificationSource: string;
	archiveRef: string;
	status: 'verified' | 'suppressed';
	note?: string;
}

const MARROW_ENTRY: ProvenanceEntry = {
	id: 'prov-1',
	owner: 'JOSIAH MARROW',
	period: '1882',
	transferType: 'Original commission — maker of record',
	verificationSource: 'Marrow workshop register; Marrow estate papers (1889)',
	archiveRef: 'MARR-WS-1882-047',
	status: 'verified',
};

const VALE_ENTRY: ProvenanceEntry = {
	id: 'prov-3',
	owner: 'SILAS VALE',
	period: '1992',
	transferType: 'Estate sale acquisition',
	verificationSource: 'Vale purchase ledger (1992); auctioneer receipt (Lot 47)',
	archiveRef: 'VALE-ACQ-1992-D6',
	status: 'verified',
};

function buildSuppressedEntry(ownerName: string): ProvenanceEntry {
	return {
		id: 'prov-2',
		owner: ownerName,
		period: '1968\u20131979',
		transferType: 'Private acquisition \u2014 source documentation restricted',
		verificationSource:
			'Estate sale record \u2014 partial. Original transfer documents restricted per verifier instruction.',
		archiveRef: 'PRV-1968-[RESTRICTED]',
		status: 'suppressed',
		note:
			'Record excluded from standard verification scope by submitting verifier. ' +
			'Restricted archive access contact: D. Reyes \u2014 provisional file reference PF-2015-071C.',
	};
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ params, request, locals }) => {
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

	// Q11 must be accessible (currentChallenge >= 11)
	if (!canAccessChallenge(auth.participant, 11)) {
		return json({ error: 'locked' }, 403);
	}

	// Read clearance from query parameter.
	// INTENTIONAL: this value is client-controlled and trusted for record scope.
	// This is the in-fiction vulnerability the participant exploits.
	const url       = new URL(request.url);
	const clearance = url.searchParams.get('clearance') ?? 'standard';

	if (clearance !== 'full') {
		// Standard scope: partial chain, no suppressed owner, VERIFIED status.
		return json({
			status:     'verified',
			confidence: 94,
			scope:      'standard',
			chain:      [MARROW_ENTRY, VALE_ENTRY],
			message:
				'Ownership continuity established. All transfers within standard verification ' +
				'scope confirmed against cross-referenced archive sources.',
		});
	}

	// Full clearance: retrieve suppressed owner from private data.
	// generateChallengeForParticipant is used to access privateData server-side.
	const roster = await getEventRoster(db, event.id);
	const { instance } = await generateChallengeForParticipant(
		{ env: getEnv(), event, rollNumber: auth.participant.rollNumber, roster },
		11,
	);
	const suppressed = (instance.privateData as { answer: string }).answer;

	return json({
		status:     'discrepancy',
		confidence: 47,
		scope:      'full',
		chain:      [MARROW_ENTRY, buildSuppressedEntry(suppressed), VALE_ENTRY],
		message:
			'Full archive view active. One record was excluded from the standard ' +
			'verification scope. Review all entries.',
	});
};
