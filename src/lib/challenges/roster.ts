/**
 * Canonical event roster retrieval for attribution. Kept SEPARATE from the pure
 * Phase 4 attribution logic so that layer stays database-independent.
 *
 * Ordering invariant: roll number ASCENDING, explicit ORDER BY — never rely on
 * implicit D1 return order. This is the same canonical order the attribution
 * assignment uses, so the roster passed in and the assignment agree.
 */
import { asc, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { participants } from '../db/schema';

/** Roll numbers for an event, ascending. */
export async function getEventRoster(
	db: AnySQLiteDb,
	eventId: number,
): Promise<number[]> {
	const rows = await db
		.select({ rollNumber: participants.rollNumber })
		.from(participants)
		.where(eq(participants.eventId, eventId))
		.orderBy(asc(participants.rollNumber));
	return rows.map((r) => r.rollNumber);
}
