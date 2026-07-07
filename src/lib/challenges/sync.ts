/**
 * Registry ↔ D1 mapping. Source-of-truth split:
 *   - CODE modules own behavior + descriptive metadata: key, title, basePoints,
 *     tier, attribution config, hints, generate(), validate().
 *   - D1 `challenges` rows own event-scoped OPERATIONAL identity: the surrogate
 *     id used as an FK target by submissions/solves/etc., plus event_id + slot,
 *     and mirror the metadata needed for relational queries (tier, base_points,
 *     attribution_enabled).
 * Executable logic (validators/generation) is NEVER stored in the database.
 *
 * The stable JOIN key between the two worlds is (event_id, slot).
 */
import { and, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { challenges } from '../db/schema';
import { RegistryDbMismatchError } from './errors';
import { getAllChallenges, TOTAL_SLOTS } from './registry';

/**
 * Deterministically upsert the 30 challenge rows for an event from the registry,
 * keyed by (event_id, slot). Idempotent — safe to run on every migrate/reseed.
 */
export async function syncChallengeRows(
	db: AnySQLiteDb,
	eventId: number,
): Promise<void> {
	for (const m of getAllChallenges()) {
		const { slot, tier, basePoints, attributionEnabled } = m.metadata;
		await db
			.insert(challenges)
			.values({ eventId, slot, tier, basePoints, attributionEnabled })
			.onConflictDoUpdate({
				target: [challenges.eventId, challenges.slot],
				set: { tier, basePoints, attributionEnabled },
			});
	}
}

/**
 * Verify the event's challenge rows agree with the registry:
 *  - exactly 30 rows, slots 1..30, no dup/missing,
 *  - every registered slot has a row and vice versa,
 *  - tier / base_points / attribution_enabled match code.
 * @throws RegistryDbMismatchError on any disagreement.
 */
export async function validateChallengeConsistency(
	db: AnySQLiteDb,
	eventId: number,
): Promise<void> {
	const rows = await db
		.select()
		.from(challenges)
		.where(eq(challenges.eventId, eventId));

	if (rows.length !== TOTAL_SLOTS) {
		throw new RegistryDbMismatchError(
			`event ${eventId}: expected ${TOTAL_SLOTS} challenge rows, got ${rows.length}`,
		);
	}

	const bySlot = new Map(rows.map((r) => [r.slot, r]));
	for (const m of getAllChallenges()) {
		const { slot, tier, basePoints, attributionEnabled } = m.metadata;
		const row = bySlot.get(slot);
		if (!row) {
			throw new RegistryDbMismatchError(`event ${eventId}: missing row for slot ${slot}`);
		}
		if (
			row.tier !== tier ||
			row.basePoints !== basePoints ||
			row.attributionEnabled !== attributionEnabled
		) {
			throw new RegistryDbMismatchError(
				`event ${eventId}: slot ${slot} metadata mismatch (code vs db)`,
			);
		}
		bySlot.delete(slot);
	}
	if (bySlot.size > 0) {
		throw new RegistryDbMismatchError(
			`event ${eventId}: db has slots with no registered module: ${[...bySlot.keys()].join(',')}`,
		);
	}
}

/** Resolve the DB challenge row id for (event, slot) — the FK later phases use. */
export async function getChallengeRowId(
	db: AnySQLiteDb,
	eventId: number,
	slot: number,
): Promise<number | undefined> {
	const row = await db
		.select({ id: challenges.id })
		.from(challenges)
		.where(and(eq(challenges.eventId, eventId), eq(challenges.slot, slot)))
		.get();
	return row?.id;
}
