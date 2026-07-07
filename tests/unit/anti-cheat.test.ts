import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { antiCheatEvents, challenges, events, participants } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { generateChallengeForParticipant, getEventRoster } from '../../src/lib/challenges';
import { ATTRIBUTION_SLOTS } from '../../src/lib/challenges/placeholders';
import { processSubmission } from '../../src/lib/submission';
import { getStrikeCount } from '../../src/lib/anti-cheat';
import type { EventRow, ParticipantRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql')).sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8')).join('\n');

const ENV = { EVENT_SECRET: 'phase5-test-secret-DO-NOT-USE-00000000' };
const STARTED = new Date('2026-07-08T10:00:00Z');
const A_SLOT = ATTRIBUTION_SLOTS[0]; // 8
const B_SLOT = ATTRIBUTION_SLOTS[1]; // 16

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

async function participantByRoll(roll: number): Promise<ParticipantRow> {
	const p = await db.select().from(participants).where(and(eq(participants.eventId, event.id), eq(participants.rollNumber, roll))).get();
	return p as ParticipantRow;
}
async function setCurrent(roll: number, slot: number) {
	await db.update(participants).set({ currentChallenge: slot }).where(and(eq(participants.eventId, event.id), eq(participants.rollNumber, roll)));
}
async function attributionAnswer(roll: number, slot: number): Promise<string> {
	const { instance } = await generateChallengeForParticipant({ env: ENV, event, rollNumber: roll, roster }, slot);
	return (instance.privateData as { answer: string }).answer;
}
function submit(p: ParticipantRow, slot: number, answer: string) {
	return processSubmission(db, { env: ENV, event, participant: p, slot, rawAnswer: answer, now: STARTED });
}
async function challengeId(slot: number) {
	return (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, event.id), eq(challenges.slot, slot))).get())!.id;
}

const ROLL_A = 25_115_000;
const ROLL_B = 25_115_001;
const ROLL_C = 25_115_002;

describe('anti-cheat detection', () => {
	it('ordinary wrong answer creates no anti-cheat event', async () => {
		const a = await participantByRoll(ROLL_A); // current = 1 (ordinary)
		await submit(a, 1, 'random-wrong');
		expect(await getStrikeCount(db, event.id, a.id)).toBe(0);
	});

	it('attribution challenge random wrong answer creates no event', async () => {
		await setCurrent(ROLL_A, A_SLOT);
		const a = await participantByRoll(ROLL_A);
		await submit(a, A_SLOT, 'not-anyones-answer-xyz');
		expect(await getStrikeCount(db, event.id, a.id)).toBe(0);
	});

	it("B submitting A's assigned answer is detected with correct identities", async () => {
		await setCurrent(ROLL_B, A_SLOT);
		const b = await participantByRoll(ROLL_B);
		const aAnswer = await attributionAnswer(ROLL_A, A_SLOT);
		const out = await submit(b, A_SLOT, aAnswer);
		expect(out.outcome).toBe('incorrect'); // participant sees generic incorrect

		const rows = await db.select().from(antiCheatEvents).where(eq(antiCheatEvents.submitterParticipantId, b.id));
		expect(rows).toHaveLength(1);
		const a = await participantByRoll(ROLL_A);
		expect(rows[0].matchedParticipantId).toBe(a.id);
		expect(rows[0].submitterParticipantId).toBe(b.id);
		expect(rows[0].challengeId).toBe(await challengeId(A_SLOT));
	});

	it("a participant's own correct answer never flags", async () => {
		await setCurrent(ROLL_A, A_SLOT);
		const a = await participantByRoll(ROLL_A);
		const own = await attributionAnswer(ROLL_A, A_SLOT);
		const out = await submit(a, A_SLOT, own);
		expect(out.outcome).toBe('correct');
		expect(await getStrikeCount(db, event.id, a.id)).toBe(0);
	});

	it('the participant response never leaks classification (generic incorrect)', async () => {
		await setCurrent(ROLL_B, A_SLOT);
		const b = await participantByRoll(ROLL_B);
		const out = await submit(b, A_SLOT, await attributionAnswer(ROLL_A, A_SLOT));
		expect(JSON.stringify(out)).toBe(JSON.stringify({ outcome: 'incorrect' }));
	});

	it('duplicate foreign submission on same challenge = one strike (idempotent)', async () => {
		await setCurrent(ROLL_B, A_SLOT);
		const b = await participantByRoll(ROLL_B);
		const ans = await attributionAnswer(ROLL_A, A_SLOT);
		await submit(b, A_SLOT, ans);
		await submit(b, A_SLOT, ans);
		await submit(b, A_SLOT, await attributionAnswer(ROLL_C, A_SLOT)); // different foreign, same challenge
		expect(await getStrikeCount(db, event.id, b.id)).toBe(1);
	});
});

describe('strike policy + elimination', () => {
	it('first strike does not eliminate', async () => {
		await setCurrent(ROLL_B, A_SLOT);
		const b = await participantByRoll(ROLL_B);
		await submit(b, A_SLOT, await attributionAnswer(ROLL_A, A_SLOT));
		const after = await participantByRoll(ROLL_B);
		expect(after.status).not.toBe('disqualified');
		expect(await getStrikeCount(db, event.id, b.id)).toBe(1);
	});

	it('second strike on a different challenge eliminates', async () => {
		// strike 1 on A_SLOT
		await setCurrent(ROLL_B, A_SLOT);
		await submit(await participantByRoll(ROLL_B), A_SLOT, await attributionAnswer(ROLL_A, A_SLOT));
		// strike 2 on B_SLOT
		await setCurrent(ROLL_B, B_SLOT);
		await submit(await participantByRoll(ROLL_B), B_SLOT, await attributionAnswer(ROLL_A, B_SLOT));
		const after = await participantByRoll(ROLL_B);
		expect(after.status).toBe('disqualified');
		expect(await getStrikeCount(db, event.id, b_id(after))).toBe(2);
	});

	it('eliminated participant cannot submit', async () => {
		await db.update(participants).set({ status: 'disqualified', currentChallenge: 1 }).where(and(eq(participants.eventId, event.id), eq(participants.rollNumber, ROLL_B)));
		const b = await participantByRoll(ROLL_B);
		const out = await submit(b, 1, await attributionAnswer(ROLL_B, 1).catch(() => 'x'));
		expect(out.outcome).toBe('eliminated');
	});
});

function b_id(p: ParticipantRow) { return p.id; }
