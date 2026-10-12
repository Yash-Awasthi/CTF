import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, type Db } from './db';
import {
	challenges,
	events,
	firstBloods,
	hintUsage,
	participants,
	solves,
} from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';

async function addChallenge(db: Db, eventId: number, slot = 1) {
	const [c] = await db
		.insert(challenges)
		.values({ eventId, slot, tier: 'easy', basePoints: 100 })
		.returning();
	return c.id;
}

describe('Phase 1 schema', () => {
	let db: Db;

	beforeEach(async () => {
		db = await freshDb();
	});

	it('seeds exactly 116 participants into a dev event (first 25115000, last 25115115)', async () => {
		const res = await seedEvent(db, DEV_EVENT);
		expect(res.count).toBe(116);

		const rows = await db
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
		await expect(
			db
				.insert(participants)
				.values({ eventId, rollNumber: 25_115_000 })
				.run(),
		).rejects.toThrow();
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

		const count = await db
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
		const [p] = await db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);
		const solveRow = {
			eventId,
			participantId: p.id,
			challengeId,
			timeFactor: 1000,
			hintFactor: 1000,
			finalScore: 100_000,
		};
		await db.insert(solves).values(solveRow).run();
		await expect(db.insert(solves).values(solveRow).run()).rejects.toThrow();
	});

	it('rejects duplicate hint usage for the same hint number but allows the other hint', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_000,
		});
		const [p] = await db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);

		await db.insert(hintUsage)
			.values({ eventId, participantId: p.id, challengeId, hintNumber: 1 })
			.run();
		// same hint number → rejected
		await expect(
			db
				.insert(hintUsage)
				.values({ eventId, participantId: p.id, challengeId, hintNumber: 1 })
				.run(),
		).rejects.toThrow();
		// the other hint number → allowed
		await db
			.insert(hintUsage)
			.values({ eventId, participantId: p.id, challengeId, hintNumber: 2 })
			.run();
	});

	it('rejects a duplicate first blood for the same event/challenge', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_001,
		});
		const ps = await db.select().from(participants).all();
		const challengeId = await addChallenge(db, eventId);

		await db.insert(firstBloods)
			.values({ eventId, challengeId, participantId: ps[0].id })
			.run();
		// a different participant cannot also claim first blood for the same challenge
		await expect(
			db
				.insert(firstBloods)
				.values({ eventId, challengeId, participantId: ps[1].id })
				.run(),
		).rejects.toThrow();
	});

	it('enforces foreign keys (bad event_id rejected)', async () => {
		await expect(
			db
				.insert(participants)
				.values({ eventId: 999_999, rollNumber: 25_115_000 })
				.run(),
		).rejects.toThrow();
	});

	it('cascades deletes from events to child rows', async () => {
		const { eventId } = await seedEvent(db, {
			...DEV_EVENT,
			rollStart: 25_115_000,
			rollEnd: 25_115_010,
		});
		expect((await db.select().from(participants).all()).length).toBe(11);

		await db.delete(events).where(eq(events.id, eventId)).run();
		expect((await db.select().from(participants).all()).length).toBe(0);
	});
});
