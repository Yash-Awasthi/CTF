import type { DB } from './client';
import { events, participants } from './schema';

/**
 * Event-scoped seeding. The roster (roll range) is a parameter so future events
 * can seed different participants. This is the reusable programmatic path used
 * by tests; the local-D1 dev seed lives in `scripts/seed-dev.sql`.
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

export async function seedEvent(
	db: DB,
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

	const rows: (typeof participants.$inferInsert)[] = [];
	for (let roll = opts.rollStart; roll <= opts.rollEnd; roll++) {
		rows.push({ eventId: event.id, rollNumber: roll });
	}
	// D1 binds at most 100 parameters per statement; a participant row binds 5.
	const [head, ...tail] = Array.from({ length: Math.ceil(rows.length / 20) }, (_, i) =>
		db.insert(participants).values(rows.slice(i * 20, i * 20 + 20)),
	);
	await db.batch([head, ...tail]);

	return {
		eventId: event.id,
		count: rows.length,
		firstRoll: opts.rollStart,
		lastRoll: opts.rollEnd,
	};
}
