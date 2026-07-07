import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { challenges, events, firstBloods, participants } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { claimFirstBlood, getFirstBloods, hasFirstBlood } from '../../src/lib/first-blood';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql')).sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8')).join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let eventId: number;
let otherEventId: number;
let pids: number[];
let challengeId: number;

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	eventId = res.eventId;
	const other = await seedEvent(db, { ...DEV_EVENT, slug: 'other-event' });
	await syncChallengeRows(db, other.eventId);
	otherEventId = other.eventId;
	void events;
	pids = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, eventId)).orderBy(participants.rollNumber).limit(3)).map((p) => p.id);
	challengeId = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, eventId), eq(challenges.slot, 1))).get())!.id;
});

describe('first blood', () => {
	it('first solver claims it', async () => {
		const r = await claimFirstBlood(db, { eventId, challengeId, participantId: pids[0] });
		expect(r.claimed).toBe(true);
		expect(await hasFirstBlood(db, eventId, challengeId)).toBe(true);
	});

	it('second solver cannot replace the first', async () => {
		await claimFirstBlood(db, { eventId, challengeId, participantId: pids[0] });
		const r = await claimFirstBlood(db, { eventId, challengeId, participantId: pids[1] });
		expect(r.claimed).toBe(false);
		const rows = await getFirstBloods(db, eventId);
		expect(rows).toHaveLength(1);
		expect(rows[0].participantId).toBe(pids[0]);
	});

	it('repeated solve by the same participant creates no second row', async () => {
		await claimFirstBlood(db, { eventId, challengeId, participantId: pids[0] });
		await claimFirstBlood(db, { eventId, challengeId, participantId: pids[0] });
		expect(await getFirstBloods(db, eventId)).toHaveLength(1);
	});

	it('concurrent claims resolve to exactly one row (one winner)', async () => {
		const results = await Promise.all(
			pids.map((pid) => claimFirstBlood(db, { eventId, challengeId, participantId: pid })),
		);
		expect(results.filter((r) => r.claimed)).toHaveLength(1);
		expect(await getFirstBloods(db, eventId)).toHaveLength(1);
	});

	it('is event- and challenge-scoped', async () => {
		await claimFirstBlood(db, { eventId, challengeId, participantId: pids[0] });
		// Same challenge slot in a DIFFERENT event has its own first blood row.
		const otherChallenge = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, otherEventId), eq(challenges.slot, 1))).get())!.id;
		const otherPid = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, otherEventId)).limit(1))[0].id;
		const r = await claimFirstBlood(db, { eventId: otherEventId, challengeId: otherChallenge, participantId: otherPid });
		expect(r.claimed).toBe(true);
		expect(await getFirstBloods(db, eventId)).toHaveLength(1);
		expect(await getFirstBloods(db, otherEventId)).toHaveLength(1);
	});
});
