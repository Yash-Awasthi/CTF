import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { challenges, events, hintUsage, participants } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { getChallengeBySlot } from '../../src/lib/challenges/registry';
import {
	getRevealedHintCount,
	getRevealedHints,
	hasUsedHint,
	HintError,
	revealHint,
} from '../../src/lib/hints';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8'))
	.join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let eventId: number;
let participantId: number;
let challengeId: number;
const SLOT = 1;

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	eventId = res.eventId;
	void events;
	participantId = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, eventId)).orderBy(participants.rollNumber).limit(1))[0].id;
	challengeId = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, eventId), eq(challenges.slot, SLOT))).get())!.id;
});

const ctx = () => ({ eventId, participantId, challengeId, slot: SLOT });

describe('hint reveal ordering + persistence', () => {
	it('reveals hint 1 then hint 2 in order', async () => {
		const r1 = await revealHint(db, { ...ctx(), hintNumber: 1 });
		expect(r1.hintNumber).toBe(1);
		expect(r1.revealedCount).toBe(1);
		expect(r1.text).toBe(getChallengeBySlot(SLOT)!.hints[0].text);

		const r2 = await revealHint(db, { ...ctx(), hintNumber: 2 });
		expect(r2.revealedCount).toBe(2);
		expect(r2.text).toBe(getChallengeBySlot(SLOT)!.hints[1].text);
	});

	it('rejects out-of-order reveal (hint 2 before hint 1)', async () => {
		await expect(revealHint(db, { ...ctx(), hintNumber: 2 })).rejects.toMatchObject({
			code: 'out_of_order',
		});
		await expect(revealHint(db, { ...ctx(), hintNumber: 2 })).rejects.toBeInstanceOf(HintError);
	});

	it('is idempotent — re-revealing hint 1 adds no second row', async () => {
		await revealHint(db, { ...ctx(), hintNumber: 1 });
		const again = await revealHint(db, { ...ctx(), hintNumber: 1 });
		expect(again.revealedCount).toBe(1);
		const rows = await db.select().from(hintUsage).where(eq(hintUsage.participantId, participantId));
		expect(rows).toHaveLength(1);
	});

	it('hasUsedHint reflects any reveal; count tracks progression', async () => {
		expect(await hasUsedHint(db, eventId, participantId, challengeId)).toBe(false);
		await revealHint(db, { ...ctx(), hintNumber: 1 });
		expect(await hasUsedHint(db, eventId, participantId, challengeId)).toBe(true);
		expect(await getRevealedHintCount(db, eventId, participantId, challengeId)).toBe(1);
	});

	it('revealed hints are retrievable (survive refresh/re-login)', async () => {
		await revealHint(db, { ...ctx(), hintNumber: 1 });
		await revealHint(db, { ...ctx(), hintNumber: 2 });
		const hints = await getRevealedHints(db, eventId, participantId, challengeId, SLOT);
		expect(hints.map((h) => h.hintNumber)).toEqual([1, 2]);
		expect(hints[0].text).toBe(getChallengeBySlot(SLOT)!.hints[0].text);
	});

	it('is participant-scoped (one participant\'s hints do not leak to another)', async () => {
		const other = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, eventId)).orderBy(participants.rollNumber).limit(2))[1].id;
		await revealHint(db, { ...ctx(), hintNumber: 1 });
		expect(await getRevealedHintCount(db, eventId, other, challengeId)).toBe(0);
	});
});
