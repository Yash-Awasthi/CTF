/**
 * Submission orchestration — the deferred POST /api/submit brain, connecting the
 * Phase 5 challenge engine and Phase 6 scoring engine. The route is a thin shell;
 * all solve/score/progression logic lives here and reuses the existing services
 * (never re-implements validation or scoring).
 *
 * Flow (correct path): access guard → engine validate → persist submission →
 * derive hint_used from D1 → recordSolve (idempotent) → advance progression
 * (conditional, idempotent) → safe result.
 *
 * Atomicity/idempotency:
 *  - solves.UNIQUE(event,participant,challenge) + recordSolve's onConflictDoNothing
 *    ⇒ at most one solve, score added at most once (Phase 6, unchanged).
 *  - progression advance is a CONDITIONAL update `WHERE current_challenge = slot`,
 *    so a duplicate/concurrent correct submit advances exactly once and never
 *    skips. Advancement is decoupled from recordSolve.created, so if a prior
 *    attempt persisted the solve but failed before advancing, a retry self-heals
 *    (the solve already exists → no double score; the guard still advances once).
 */
import { and, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { SecretEnv } from '../crypto/secrets';
import type { EventRow, ParticipantRow } from '../auth/types';
import { challenges, participants, solves, submissions } from '../db/schema';
import {
	getChallengeAccessStatus,
	getEventRoster,
	validateChallengeAnswer,
	TOTAL_SLOTS,
} from '../challenges';
import { hasUsedHint } from '../hints';
import { recordSolve } from '../scoring';

export type SubmitOutcome =
	| { outcome: 'locked' }
	| { outcome: 'already_solved' }
	| { outcome: 'not_found' }
	| { outcome: 'incorrect' }
	| {
			outcome: 'correct';
			finalScore: number;
			timeFactor: number;
			hintFactor: number;
			hintUsed: boolean;
			currentChallenge: number;
			completed: boolean;
	  };

export interface ProcessSubmissionInput {
	env: SecretEnv;
	event: EventRow;
	participant: ParticipantRow;
	slot: number;
	rawAnswer: string;
	now: Date;
}

/**
 * Process one answer submission. Assumes the caller already enforced auth +
 * authoritative LIVE event state. Persists EVERY attempt in `submissions`.
 */
export async function processSubmission(
	db: AnySQLiteDb,
	input: ProcessSubmissionInput,
): Promise<SubmitOutcome> {
	const { env, event, participant, slot, rawAnswer, now } = input;

	// 1. Progression guard — only the current challenge is submittable.
	const status = getChallengeAccessStatus(participant, slot);
	if (status === 'locked') return { outcome: 'locked' };
	if (status === 'solved') return { outcome: 'already_solved' };

	// 2. Resolve the challenge row (FK target + base points).
	const challenge = await db
		.select({ id: challenges.id, basePoints: challenges.basePoints })
		.from(challenges)
		.where(and(eq(challenges.eventId, event.id), eq(challenges.slot, slot)))
		.get();
	if (!challenge) return { outcome: 'not_found' };

	// 3. Validate through the Phase 5 engine (normalization + module validator).
	const roster = await getEventRoster(db, event.id);
	const result = await validateChallengeAnswer(
		{ env, event, rollNumber: participant.rollNumber, roster },
		slot,
		rawAnswer,
	);

	// 4. Persist the attempt regardless of outcome (Phase 8 will inspect these).
	await db.insert(submissions).values({
		eventId: event.id,
		participantId: participant.id,
		challengeId: challenge.id,
		submittedAnswer: rawAnswer,
		isCorrect: result.correct,
	});

	if (!result.correct) return { outcome: 'incorrect' };

	// 5. Correct: hint_used derived ONLY from persisted state (never the client).
	const hintUsed = await hasUsedHint(db, event.id, participant.id, challenge.id);

	// 6. Score + persist solve exactly once (Phase 6, idempotent).
	await recordSolve(db, {
		event,
		participantId: participant.id,
		challengeId: challenge.id,
		basePoints: challenge.basePoints,
		hintUsed,
		solvedAt: now,
	});

	// 7. Advance progression once, conditionally (idempotent, race-safe). Slot 30
	//    saturates at 30 — completion is derived from the solve row, not a counter.
	if (slot < TOTAL_SLOTS) {
		await db
			.update(participants)
			.set({ currentChallenge: slot + 1 })
			.where(and(eq(participants.id, participant.id), eq(participants.currentChallenge, slot)));
	}

	// 8. Return the AUTHORITATIVE persisted score (handles idempotent re-submits).
	const solveRow = await db
		.select({
			finalScore: solves.finalScore,
			timeFactor: solves.timeFactor,
			hintFactor: solves.hintFactor,
		})
		.from(solves)
		.where(
			and(
				eq(solves.eventId, event.id),
				eq(solves.participantId, participant.id),
				eq(solves.challengeId, challenge.id),
			),
		)
		.get();

	const currentChallenge = slot < TOTAL_SLOTS ? slot + 1 : TOTAL_SLOTS;
	return {
		outcome: 'correct',
		finalScore: solveRow?.finalScore ?? 0,
		timeFactor: solveRow?.timeFactor ?? 0,
		hintFactor: solveRow?.hintFactor ?? 0,
		hintUsed,
		currentChallenge,
		completed: slot === TOTAL_SLOTS,
	};
}
