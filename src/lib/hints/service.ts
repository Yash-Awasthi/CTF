/**
 * Hint system (build plan Phase 7). Two hints per challenge, revealed strictly
 * in order. The FIRST hint used on a challenge locks that challenge's
 * hint_factor to 0.5 permanently — the second hint does NOT stack (scoring reads
 * "any hint used", see src/lib/scoring). Hint state is participant- and
 * event-scoped, persisted in `hint_usage` (Phase 1), and idempotent.
 *
 * Hint content comes from the Phase 5 module contract (module.hints) and is only
 * returned AFTER a successful server-side reveal — never before consumption.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { hintUsage } from '../db/schema';
import { getChallengeHints } from '../challenges/engine';
import { getChallengeBySlot } from '../challenges/registry';

export const MAX_HINTS = 2;

export class HintError extends Error {
	constructor(
		message: string,
		readonly code: 'out_of_order' | 'invalid_hint' | 'no_module',
	) {
		super(message);
		this.name = 'HintError';
	}
}

/** How many hints this participant has revealed for this challenge (0..2). */
export async function getRevealedHintCount(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
	challengeId: number,
): Promise<number> {
	const rows = await db
		.select({ hintNumber: hintUsage.hintNumber })
		.from(hintUsage)
		.where(
			and(
				eq(hintUsage.eventId, eventId),
				eq(hintUsage.participantId, participantId),
				eq(hintUsage.challengeId, challengeId),
			),
		);
	return rows.length;
}

/** True iff ANY hint was used — the scoring hint_used flag. */
export async function hasUsedHint(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
	challengeId: number,
): Promise<boolean> {
	return (await getRevealedHintCount(db, eventId, participantId, challengeId)) > 0;
}

export interface RevealedHint {
	hintNumber: number;
	text: string;
}

/** The already-revealed hints (ordered), for re-rendering after refresh. */
export async function getRevealedHints(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
	challengeId: number,
	slot: number,
): Promise<RevealedHint[]> {
	const rows = await db
		.select({ hintNumber: hintUsage.hintNumber })
		.from(hintUsage)
		.where(
			and(
				eq(hintUsage.eventId, eventId),
				eq(hintUsage.participantId, participantId),
				eq(hintUsage.challengeId, challengeId),
			),
		)
		.orderBy(asc(hintUsage.hintNumber));
	const hints = getChallengeHints(slot);
	return rows.map((r) => ({
		hintNumber: r.hintNumber,
		text: hints[r.hintNumber - 1].text,
	}));
}

export interface RevealResult {
	hintNumber: number;
	text: string;
	revealedCount: number;
	/** Always true after a reveal — the challenge is now at hint_factor 0.5. */
	hintUsed: true;
}

/**
 * Reveal a hint in order. Enforces:
 *  - hintNumber ∈ {1,2},
 *  - strictly sequential (can only reveal count+1),
 *  - idempotent for an already-revealed hint (returns its content, no new row).
 * Persistence guarded by UNIQUE(event,participant,challenge,hint_number).
 */
export async function revealHint(
	db: AnySQLiteDb,
	params: {
		eventId: number;
		participantId: number;
		challengeId: number;
		slot: number;
		hintNumber: number;
	},
): Promise<RevealResult> {
	const { eventId, participantId, challengeId, slot, hintNumber } = params;
	if (hintNumber < 1 || hintNumber > MAX_HINTS) {
		throw new HintError(`invalid hint number ${hintNumber}`, 'invalid_hint');
	}
	const module = getChallengeBySlot(slot);
	if (!module) throw new HintError(`no module for slot ${slot}`, 'no_module');

	const currentCount = await getRevealedHintCount(db, eventId, participantId, challengeId);

	// Ordering: may only reveal the immediate next hint. Requesting an already
	// revealed hint (<= currentCount) is idempotent; skipping ahead is rejected.
	if (hintNumber > currentCount + 1) {
		throw new HintError(
			`hint ${hintNumber} out of order (have ${currentCount})`,
			'out_of_order',
		);
	}

	// Idempotent insert — a duplicate request does not create a second row.
	await db
		.insert(hintUsage)
		.values({ eventId, participantId, challengeId, hintNumber })
		.onConflictDoNothing({
			target: [
				hintUsage.eventId,
				hintUsage.participantId,
				hintUsage.challengeId,
				hintUsage.hintNumber,
			],
		});

	const revealedCount = await getRevealedHintCount(db, eventId, participantId, challengeId);
	const text = module.hints[hintNumber - 1].text;
	return { hintNumber, text, revealedCount, hintUsed: true };
}
