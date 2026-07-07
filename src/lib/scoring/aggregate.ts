/**
 * Score persistence + aggregation. Idempotent per solve (Phase 1 uniqueness:
 * UNIQUE(event_id, participant_id, challenge_id)).
 *
 * Aggregate strategy (build plan recommended):
 *   - solves.final_score is the authoritative per-solve value.
 *   - participants.score is a CACHED aggregate, incremented in the SAME write
 *     path as the solve insert (only when a NEW solve row is actually created).
 *   - recomputeParticipantScore / verifyParticipantScore provide a consistency
 *     path from the source-of-truth solves.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { EventRow } from '../auth/types';
import { participants, solves } from '../db/schema';
import { calculateSolveScoreForEvent } from './calculate';
import type { SolveScore } from './types';

export interface RecordSolveInput {
	event: EventRow;
	participantId: number;
	challengeId: number;
	/** Challenge base points (from the challenge row / registry). */
	basePoints: number;
	/** Whether any hint was used on this challenge. */
	hintUsed: boolean;
	/** Authoritative solve timestamp (server time). */
	solvedAt: Date;
}

export interface RecordSolveResult {
	/** True iff a NEW solve row was written (and score added). */
	created: boolean;
	score: SolveScore;
}

/**
 * Persist a scored solve exactly once and increment the participant's cached
 * total. If a solve already exists for (event, participant, challenge), this is
 * a no-op for scoring — score is never double-added.
 */
export async function recordSolve(
	db: AnySQLiteDb,
	input: RecordSolveInput,
): Promise<RecordSolveResult> {
	const { event, participantId, challengeId, basePoints, hintUsed, solvedAt } = input;
	const score = calculateSolveScoreForEvent(basePoints, event, solvedAt, hintUsed);

	// Insert guarded by the unique constraint. onConflictDoNothing → the insert
	// silently no-ops if the solve already exists; returning() tells us which.
	const inserted = await db
		.insert(solves)
		.values({
			eventId: event.id,
			participantId,
			challengeId,
			solvedAt,
			timeFactor: score.timeFactor,
			hintFactor: score.hintFactor,
			finalScore: score.finalScore,
		})
		.onConflictDoNothing({
			target: [solves.eventId, solves.participantId, solves.challengeId],
		})
		.returning({ id: solves.id });

	if (inserted.length === 0) {
		return { created: false, score };
	}

	// Atomic increment of the cached aggregate (only on a fresh solve).
	await db
		.update(participants)
		.set({ score: sql`${participants.score} + ${score.finalScore}` })
		.where(eq(participants.id, participantId));

	return { created: true, score };
}

/** Sum of a participant's solve final scores (source-of-truth, milli-points). */
export async function recomputeParticipantScore(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
): Promise<number> {
	const row = await db
		.select({ total: sql<number>`COALESCE(SUM(${solves.finalScore}), 0)` })
		.from(solves)
		.where(and(eq(solves.eventId, eventId), eq(solves.participantId, participantId)))
		.get();
	return row?.total ?? 0;
}

/** Consistency check: cached participants.score vs recomputed sum of solves. */
export async function verifyParticipantScore(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
): Promise<{ cached: number; recomputed: number; consistent: boolean }> {
	const p = await db
		.select({ score: participants.score })
		.from(participants)
		.where(eq(participants.id, participantId))
		.get();
	const cached = p?.score ?? 0;
	const recomputed = await recomputeParticipantScore(db, eventId, participantId);
	return { cached, recomputed, consistent: cached === recomputed };
}

export interface LeaderboardRow {
	participantId: number;
	rollNumber: number;
	score: number; // milli-points
	solveCount: number;
	/** Timestamp of the participant's most recent (final) solve, or null. */
	lastSolveAt: number | null;
}

/**
 * Leaderboard ordering from PERSISTED milli-point totals. Order: score DESC,
 * then earliest final-solve wins (build-plan tie fallback: lastSolveAt ASC),
 * then roll number ASC as a final deterministic tiebreak.
 */
export async function getLeaderboard(
	db: AnySQLiteDb,
	eventId: number,
): Promise<LeaderboardRow[]> {
	const lastSolve = sql<number | null>`MAX(${solves.solvedAt})`;
	const rows = await db
		.select({
			participantId: participants.id,
			rollNumber: participants.rollNumber,
			score: participants.score,
			solveCount: sql<number>`COUNT(${solves.id})`,
			lastSolveAt: lastSolve,
		})
		.from(participants)
		.leftJoin(
			solves,
			and(eq(solves.participantId, participants.id), eq(solves.eventId, eventId)),
		)
		.where(eq(participants.eventId, eventId))
		.groupBy(participants.id)
		.orderBy(
			desc(participants.score),
			// NULL last-solve (no solves) sorts last among equal scores.
			asc(sql`CASE WHEN ${lastSolve} IS NULL THEN 1 ELSE 0 END`),
			asc(lastSolve),
			asc(participants.rollNumber),
		);
	return rows.map((r) => ({
		participantId: r.participantId,
		rollNumber: r.rollNumber,
		score: r.score,
		solveCount: Number(r.solveCount),
		lastSolveAt: r.lastSolveAt ?? null,
	}));
}

/** Per-participant solve history (most recent first). */
export async function getSolveHistory(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
) {
	return db
		.select()
		.from(solves)
		.where(and(eq(solves.eventId, eventId), eq(solves.participantId, participantId)))
		.orderBy(desc(solves.solvedAt));
}

/** Per-challenge solve counts for an event (challengeId → count). */
export async function getChallengeSolveCounts(
	db: AnySQLiteDb,
	eventId: number,
): Promise<Map<number, number>> {
	const rows = await db
		.select({
			challengeId: solves.challengeId,
			count: sql<number>`COUNT(${solves.id})`,
		})
		.from(solves)
		.where(eq(solves.eventId, eventId))
		.groupBy(solves.challengeId);
	return new Map(rows.map((r) => [r.challengeId, Number(r.count)]));
}
