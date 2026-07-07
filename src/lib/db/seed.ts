import { events, participants } from './schema';

/**
 * Event-scoped seeding. The roster (roll range) is a parameter so future events
 * can seed different participants. This is the reusable programmatic path used
 * by tests; the local-D1 dev seed lives in `scripts/seed-dev.sql`.
 *
 * `db` is any Drizzle client whose insert(...).values(...).returning() works
 * synchronously-or-async (better-sqlite3 in tests, D1 at runtime) — hence await.
 */
export interface SeedEventOptions {
	name: string;
	slug: string;
	durationSeconds: number;
	secretVersion?: string;
	rollStart: number;
	rollEnd: number; // inclusive
}

export interface SeedEventResult {
	eventId: number;
	count: number;
	firstRoll: number;
	lastRoll: number;
}

/** Fixed dev-event roster: roll numbers 25115000–25115115 (116 participants). */
export const DEV_EVENT: SeedEventOptions = {
	name: 'Case Files — Dev Event',
	slug: 'case-files-dev-2026',
	durationSeconds: 4 * 60 * 60, // 4 hours
	secretVersion: 'v1',
	rollStart: 25_115_000,
	rollEnd: 25_115_115,
};

// Narrow structural type so this file has no hard dependency on a specific
// Drizzle driver (D1 vs better-sqlite3).
type InsertableDb = {
	insert: (table: typeof events | typeof participants) => {
		values: (rows: unknown) => {
			returning: () => Promise<Array<{ id: number }>> | Array<{ id: number }>;
		};
	};
};

export async function seedEvent(
	db: InsertableDb,
	opts: SeedEventOptions,
): Promise<SeedEventResult> {
	if (opts.rollEnd < opts.rollStart) {
		throw new Error('rollEnd must be >= rollStart');
	}

	const [event] = await db
		.insert(events)
		.values({
			name: opts.name,
			slug: opts.slug,
			durationSeconds: opts.durationSeconds,
			secretVersion: opts.secretVersion ?? 'v1',
		})
		.returning();

	const rows = [];
	for (let roll = opts.rollStart; roll <= opts.rollEnd; roll++) {
		rows.push({ eventId: event.id, rollNumber: roll });
	}
	await db.insert(participants).values(rows).returning();

	return {
		eventId: event.id,
		count: rows.length,
		firstRoll: opts.rollStart,
		lastRoll: opts.rollEnd,
	};
}
