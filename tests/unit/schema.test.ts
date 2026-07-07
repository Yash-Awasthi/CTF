import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	challenges,
	events,
	firstBloods,
	hintUsage,
	participants,
	solves,
} from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');

function loadMigrationSql(): string {
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.sql'))
		.sort();
	if (files.length === 0) {
		throw new Error(
			'No migrations found — run `pnpm db:generate` before the schema tests.',
		);
	}
	return files
		.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
		.join('\n');
}

const MIGRATION_SQL = loadMigrationSql();

function makeDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	return { sqlite, db: drizzle(sqlite) };
}

type Db = ReturnType<typeof makeDb>['db'];

async function addChallenge(db: Db, eventId: number, slot = 1) {
	const [c] = await db
		.insert(challenges)
		.values({ eventId, slot, tier: 'easy', basePoints: 100 })
		.returning();
	return c.id;
}

describe('Phase 1 schema', () => {
	let db: Db;

	beforeEach(() => {
		db = makeDb().db;
	});

	it('seeds exactly 116 participants into a dev event (first 25115000, last 25115115)', async () => {
		const res = await seedEvent(db, DEV_EVENT);
		expect(res.count).toBe(116);

		const rows = db
			.select({ roll: participants.rollNumber })
			.from(participants)
			.where(eq(participants.eventId, res.eventId))
			.orderBy(participants.rollNumber)
			.all();
		expect(rows.length).toBe(116);
		expect(rows[0].roll).toBe(25_115_000);
		expect(rows[rows.length - 1].roll).toBe(25_115_115);
	});

	it('rejects a duplicate (event_id, roll_number)', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_002,
		});
		expect(() =>
			db
				.insert(participants)
				.values({ eventId, rollNumber: 25_115_000 })
				.run(),
		).toThrow();
	});

	it('allows the same roll number in two different events', async () => {
		const a = await seedEvent(db, {
			...DEV_EVENT,
			slug: 'event-a',
			rollStart: 25_115_000,
			rollEnd: 25_115_000,
		});
		const b = await seedEvent(db, {
			...DEV_EVENT,
			slug: 'event-b',
			rollStart: 25_115_000,
			rollEnd: 25_115_000,
		});
		expect(a.eventId).not.toBe(b.eventId);

		const count = db
			.select({ n: sql<number>`count(*)` })
			.from(participants)
			.where(eq(participants.rollNumber, 25_115_000))
			.get();
		expect(count?.n).toBe(2);
	});

	it('rejects a duplicate solve for the same participant/challenge/event', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_000,
		});
		const [p] = db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);
		const solveRow = {
			eventId,
			participantId: p.id,
			challengeId,
			timeFactor: 1000,
			hintFactor: 1000,
			finalScore: 100_000,
		};
		db.insert(solves).values(solveRow).run();
		expect(() => db.insert(solves).values(solveRow).run()).toThrow();
	});

	it('rejects duplicate hint usage for the same hint number but allows the other hint', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_000,
		});
		const [p] = db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);

		db.insert(hintUsage)
			.values({ eventId, participantId: p.id, challengeId, hintNumber: 1 })
			.run();
		// same hint number → rejected
		expect(() =>
			db
				.insert(hintUsage)
				.values({ eventId, participantId: p.id, challengeId, hintNumber: 1 })
				.run(),
		).toThrow();
		// the other hint number → allowed
		expect(() =>
			db
				.insert(hintUsage)
				.values({ eventId, participantId: p.id, challengeId, hintNumber: 2 })
				.run(),
		).not.toThrow();
	});

	it('rejects a duplicate first blood for the same event/challenge', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_001,
		});
		const ps = db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);

		db.insert(firstBloods)
			.values({ eventId, challengeId, participantId: ps[0].id })
			.run();
		// a different participant cannot also claim first blood for the same challenge
		expect(() =>
			db
				.insert(firstBloods)
				.values({ eventId, challengeId, participantId: ps[1].id })
				.run(),
		).toThrow();
	});

	it('enforces foreign keys (bad event_id rejected)', () => {
		expect(() =>
			db
				.insert(participants)
				.values({ eventId: 999_999, rollNumber: 25_115_000 })
				.run(),
		).toThrow();
	});

	it('cascades deletes from events to child rows', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_010,
		});
		expect(db.select().from(participants).all().length).toBe(11);

		db.delete(events).where(eq(events.id, eventId)).run();
		expect(db.select().from(participants).all().length).toBe(0);
	});
});
