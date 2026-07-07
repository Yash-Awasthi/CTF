import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { challenges, events, participants, solves, submissions } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { generateChallengeForParticipant, getEventRoster } from '../../src/lib/challenges';
import { revealHint } from '../../src/lib/hints';
import { processSubmission } from '../../src/lib/submission';
import type { EventRow, ParticipantRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8'))
	.join('\n');

const ENV = { EVENT_SECRET: 'phase5-test-secret-DO-NOT-USE-00000000' };
const STARTED = new Date('2026-07-08T10:00:00Z');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let event: EventRow;
let roster: number[];

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	const seeded = await db.select().from(events).where(eq(events.id, res.eventId)).get();
	event = { ...(seeded as EventRow), startedAt: STARTED };
	roster = await getEventRoster(db, res.eventId);
});

async function firstParticipant(): Promise<ParticipantRow> {
	const p = await db
		.select()
		.from(participants)
		.where(eq(participants.eventId, event.id))
		.orderBy(participants.rollNumber)
		.limit(1);
	return p[0] as ParticipantRow;
}

/** The correct answer for a participant+slot (via the engine's private data). */
async function correctAnswer(rollNumber: number, slot: number): Promise<string> {
	const { instance } = await generateChallengeForParticipant(
		{ env: ENV, event, rollNumber, roster },
		slot,
	);
	return (instance.privateData as { answer: string }).answer;
}

async function challengeIdForSlot(slot: number): Promise<number> {
	const c = await db
		.select({ id: challenges.id })
		.from(challenges)
		.where(and(eq(challenges.eventId, event.id), eq(challenges.slot, slot)))
		.get();
	return c!.id;
}

function submit(participant: ParticipantRow, slot: number, answer: string) {
	return processSubmission(db, { env: ENV, event, participant, slot, rawAnswer: answer, now: STARTED });
}

describe('incorrect submissions', () => {
	it('does not create a solve or advance, but logs the attempt', async () => {
		const p = await firstParticipant();
		const out = await submit(p, 1, 'totally-wrong');
		expect(out.outcome).toBe('incorrect');

		const solveRows = await db.select().from(solves).where(eq(solves.participantId, p.id));
		expect(solveRows).toHaveLength(0);
		const subRows = await db.select().from(submissions).where(eq(submissions.participantId, p.id));
		expect(subRows).toHaveLength(1);
		expect(subRows[0].isCorrect).toBe(false);
		const after = await db.select({ c: participants.currentChallenge }).from(participants).where(eq(participants.id, p.id)).get();
		expect(after?.c).toBe(1); // unchanged
	});
});

describe('correct submissions', () => {
	it('creates one solve, scores once, advances current_challenge once', async () => {
		const p = await firstParticipant();
		const ans = await correctAnswer(p.rollNumber, 1);
		const out = await submit(p, 1, ans);
		expect(out.outcome).toBe('correct');
		if (out.outcome !== 'correct') throw new Error();
		expect(out.finalScore).toBe(100_000); // slot 1 base 100, t=0, no hint
		expect(out.hintFactor).toBe(1000);
		expect(out.currentChallenge).toBe(2);

		const solveRows = await db.select().from(solves).where(eq(solves.participantId, p.id));
		expect(solveRows).toHaveLength(1);
		const pr = await db.select().from(participants).where(eq(participants.id, p.id)).get();
		expect(pr?.score).toBe(100_000);
		expect(pr?.currentChallenge).toBe(2);
	});

	it('correct after one hint applies hint_factor 0.5 (server-derived)', async () => {
		const p = await firstParticipant();
		await revealHint(db, { eventId: event.id, participantId: p.id, challengeId: await challengeIdForSlot(1), slot: 1, hintNumber: 1 });
		const ans = await correctAnswer(p.rollNumber, 1);
		const out = await submit(p, 1, ans);
		if (out.outcome !== 'correct') throw new Error();
		expect(out.hintUsed).toBe(true);
		expect(out.hintFactor).toBe(500);
		expect(out.finalScore).toBe(50_000);
	});

	it('correct after two hints still applies only one 0.5 factor', async () => {
		const p = await firstParticipant();
		const cid = await challengeIdForSlot(1);
		await revealHint(db, { eventId: event.id, participantId: p.id, challengeId: cid, slot: 1, hintNumber: 1 });
		await revealHint(db, { eventId: event.id, participantId: p.id, challengeId: cid, slot: 1, hintNumber: 2 });
		const ans = await correctAnswer(p.rollNumber, 1);
		const out = await submit(p, 1, ans);
		if (out.outcome !== 'correct') throw new Error();
		expect(out.hintFactor).toBe(500);
		expect(out.finalScore).toBe(50_000); // not 25000
	});

	it('the response never contains the correct answer or private data', async () => {
		const p = await firstParticipant();
		const ans = await correctAnswer(p.rollNumber, 1);
		const out = await submit(p, 1, ans);
		const serialized = JSON.stringify(out);
		expect(serialized).not.toContain(ans);
		expect(serialized).not.toContain('privateData');
		expect(serialized).not.toContain('answer');
	});
});

describe('idempotency + progression guards', () => {
	it('a second submit after solving is rejected (already_solved) — no double score', async () => {
		const p = await firstParticipant();
		const ans = await correctAnswer(p.rollNumber, 1);
		await submit(p, 1, ans);
		const reloaded = await db.select().from(participants).where(eq(participants.id, p.id)).get() as ParticipantRow;
		const again = await submit(reloaded, 1, ans);
		expect(again.outcome).toBe('already_solved');
		const pr = await db.select().from(participants).where(eq(participants.id, p.id)).get();
		expect(pr?.score).toBe(100_000); // unchanged
		const solveRows = await db.select().from(solves).where(eq(solves.participantId, p.id));
		expect(solveRows).toHaveLength(1);
	});

	it('re-processing while still current is idempotent (no double add, self-heals advance)', async () => {
		const p = await firstParticipant();
		const ans = await correctAnswer(p.rollNumber, 1);
		await submit(p, 1, ans);
		// Simulate a crash-before-advance: reset progression to slot 1 with the solve present.
		await db.update(participants).set({ currentChallenge: 1 }).where(eq(participants.id, p.id));
		const stillCurrent = await db.select().from(participants).where(eq(participants.id, p.id)).get() as ParticipantRow;
		const out = await submit(stillCurrent, 1, ans);
		expect(out.outcome).toBe('correct');
		const solveRows = await db.select().from(solves).where(eq(solves.participantId, p.id));
		expect(solveRows).toHaveLength(1); // still one solve
		const pr = await db.select().from(participants).where(eq(participants.id, p.id)).get();
		expect(pr?.score).toBe(100_000); // score not doubled
		expect(pr?.currentChallenge).toBe(2); // advance re-applied
	});

	it('rejects a future (locked) challenge submission', async () => {
		const p = await firstParticipant(); // current = 1
		const ans = await correctAnswer(p.rollNumber, 2);
		const out = await submit(p, 2, ans);
		expect(out.outcome).toBe('locked');
		const solveRows = await db.select().from(solves).where(eq(solves.participantId, p.id));
		expect(solveRows).toHaveLength(0);
	});

	it('slot 30 completion saturates current_challenge at 30', async () => {
		const p = await firstParticipant();
		await db.update(participants).set({ currentChallenge: 30 }).where(eq(participants.id, p.id));
		const atFinal = await db.select().from(participants).where(eq(participants.id, p.id)).get() as ParticipantRow;
		const ans = await correctAnswer(p.rollNumber, 30);
		const out = await submit(atFinal, 30, ans);
		if (out.outcome !== 'correct') throw new Error();
		expect(out.completed).toBe(true);
		expect(out.currentChallenge).toBe(30);
		const pr = await db.select().from(participants).where(eq(participants.id, p.id)).get();
		expect(pr?.currentChallenge).toBe(30); // saturated, not 31
	});
});
