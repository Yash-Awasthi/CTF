/**
 * Phase 9 first blood: atomic first-solver detection per (event, challenge).
 * Uses the Phase 1 UNIQUE(event_id, challenge_id) on `first_bloods` +
 * onConflictDoNothing so concurrent solves produce EXACTLY ONE winner. The
 * solve itself is unaffected whether or not first blood is claimed.
 *
 * The generic UX message ("First blood: Q7 has been cracked.") exposes only the
 * challenge slot — never the solver. SSE (Phase 12) broadcasts it.
 */
import { and, asc, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { firstBloods } from '../db/schema';

export interface FirstBloodClaim {
	/** True iff THIS call won first blood (a new row was inserted). */
	claimed: boolean;
}

/** Attempt to claim first blood. Idempotent, race-safe. */
export async function claimFirstBlood(
	db: AnySQLiteDb,
	params: { eventId: number; challengeId: number; participantId: number; now?: Date },
): Promise<FirstBloodClaim> {
	const values: {
		eventId: number;
		challengeId: number;
		participantId: number;
		claimedAt?: Date;
	} = {
		eventId: params.eventId,
		challengeId: params.challengeId,
		participantId: params.participantId,
	};
	if (params.now) values.claimedAt = params.now;

	const inserted = await db
		.insert(firstBloods)
		.values(values)
		.onConflictDoNothing({ target: [firstBloods.eventId, firstBloods.challengeId] })
		.returning({ id: firstBloods.id });

	return { claimed: inserted.length > 0 };
}

/** All first-blood rows for an event (ascending claim order). */
export async function getFirstBloods(db: AnySQLiteDb, eventId: number) {
	return db
		.select()
		.from(firstBloods)
		.where(eq(firstBloods.eventId, eventId))
		.orderBy(asc(firstBloods.claimedAt));
}

/** Whether a specific challenge already has first blood (event-scoped). */
export async function hasFirstBlood(
	db: AnySQLiteDb,
	eventId: number,
	challengeId: number,
): Promise<boolean> {
	const row = await db
		.select({ id: firstBloods.id })
		.from(firstBloods)
		.where(and(eq(firstBloods.eventId, eventId), eq(firstBloods.challengeId, challengeId)))
		.get();
	return !!row;
}
