/**
 * Phase 10 leaderboard. Reads PERSISTED milli-point totals (never recomputes in
 * the normal path). Ordering (locked): score DESC → earliest final solve
 * (MAX(solved_at) ASC, no-solves last) → roll ASC (deterministic tertiary).
 *
 * Visibility policy:
 *  - Participants NEVER see standings (no participant route exposes ranks).
 *  - Admin sees full live standings anytime (incl. strike/elimination state).
 *  - Public standings are served ONLY when events.state = RESULTS_PUBLISHED,
 *    exclude eliminated participants, and show unmasked roll numbers.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { EventRow } from '../auth/types';
import { antiCheatEvents, participants, solves } from '../db/schema';
import { ELIMINATED_STATUS } from '../anti-cheat';

export interface LeaderboardEntry {
	participantId: number;
	rollNumber: number;
	score: number; // persisted milli-points
	solveCount: number;
	lastSolveAt: number | null;
	status: string;
	eliminated: boolean;
}

export interface AdminLeaderboardEntry extends LeaderboardEntry {
	strikeCount: number;
}

const lastSolve = sql<number | null>`MAX(${solves.solvedAt})`;

/** Base standings query for an event, in locked deterministic order. */
async function standings(db: AnySQLiteDb, eventId: number): Promise<LeaderboardEntry[]> {
	const rows = await db
		.select({
			participantId: participants.id,
			rollNumber: participants.rollNumber,
			score: participants.score,
			status: participants.status,
			solveCount: sql<number>`COUNT(${solves.id})`,
			lastSolveAt: lastSolve,
		})
		.from(participants)
		.leftJoin(solves, and(eq(solves.participantId, participants.id), eq(solves.eventId, eventId)))
		.where(eq(participants.eventId, eventId))
		.groupBy(participants.id)
		.orderBy(
			desc(participants.score),
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
		status: r.status,
		eliminated: r.status === ELIMINATED_STATUS,
	}));
}

/** Admin live standings — everyone (incl. eliminated), with strike counts. */
export async function getAdminLeaderboard(
	db: AnySQLiteDb,
	eventId: number,
): Promise<AdminLeaderboardEntry[]> {
	const base = await standings(db, eventId);
	const strikeRows = await db
		.select({
			participantId: antiCheatEvents.submitterParticipantId,
			count: sql<number>`COUNT(${antiCheatEvents.id})`,
		})
		.from(antiCheatEvents)
		.where(eq(antiCheatEvents.eventId, eventId))
		.groupBy(antiCheatEvents.submitterParticipantId);
	const strikes = new Map(strikeRows.map((r) => [r.participantId, Number(r.count)]));
	return base.map((e) => ({ ...e, strikeCount: strikes.get(e.participantId) ?? 0 }));
}

export class LeaderboardNotPublicError extends Error {
	constructor() {
		super('leaderboard_not_published');
		this.name = 'LeaderboardNotPublicError';
	}
}

/**
 * Public standings — ONLY after RESULTS_PUBLISHED. Excludes eliminated
 * participants. Unmasked roll numbers. Throws before publication.
 */
export async function getPublicLeaderboard(
	db: AnySQLiteDb,
	event: EventRow,
): Promise<LeaderboardEntry[]> {
	if (event.state !== 'RESULTS_PUBLISHED') throw new LeaderboardNotPublicError();
	const base = await standings(db, event.id);
	return base.filter((e) => !e.eliminated);
}

/** Whether public standings may be served for this event state. */
export function isLeaderboardPublic(event: EventRow): boolean {
	return event.state === 'RESULTS_PUBLISHED';
}
