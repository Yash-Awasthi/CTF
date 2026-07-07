import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { antiCheatEvents, challenges, events, participants, solves } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { getAdminLeaderboard, getPublicLeaderboard, LeaderboardNotPublicError } from '../../src/lib/leaderboard';
import type { EventRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql')).sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8')).join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let event: EventRow;
let pids: number[];
let ch1: number;

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	event = (await db.select().from(events).where(eq(events.id, res.eventId)).get()) as EventRow;
	pids = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, event.id)).orderBy(participants.rollNumber).limit(4)).map((p) => p.id);
	ch1 = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, event.id), eq(challenges.slot, 1))).get())!.id;
});

async function giveScore(pid: number, score: number, solvedAt: Date) {
	await db.insert(solves).values({ eventId: event.id, participantId: pid, challengeId: ch1, solvedAt, timeFactor: 1000, hintFactor: 1000, finalScore: score });
	await db.update(participants).set({ score }).where(eq(participants.id, pid));
}
const T = (s: number) => new Date(Date.UTC(2026, 6, 8, 10, 0, s));

describe('ordering', () => {
	it('score descending, tie fallback earliest final solve, then roll asc', async () => {
		await giveScore(pids[0], 100_000, T(50));
		await giveScore(pids[1], 90_000, T(10)); // tie with pids[2] on score
		await giveScore(pids[2], 90_000, T(30)); // later final solve → ranks below pids[1]
		const lb = await getAdminLeaderboard(db, event.id);
		const nonZero = lb.filter((r) => r.score > 0);
		expect(nonZero.map((r) => r.participantId)).toEqual([pids[0], pids[1], pids[2]]);
	});
});

describe('elimination + strikes', () => {
	it('admin sees strike counts and eliminated participants', async () => {
		await giveScore(pids[0], 50_000, T(10));
		await db.update(participants).set({ status: 'disqualified' }).where(eq(participants.id, pids[0]));
		await db.insert(antiCheatEvents).values({ eventId: event.id, submitterParticipantId: pids[0], challengeId: ch1, matchedParticipantId: pids[1], submittedAnswer: 'x' });
		const lb = await getAdminLeaderboard(db, event.id);
		const row = lb.find((r) => r.participantId === pids[0])!;
		expect(row.eliminated).toBe(true);
		expect(row.strikeCount).toBe(1);
	});
});

describe('public visibility policy', () => {
	it('throws before RESULTS_PUBLISHED (hidden during READY/LIVE/FROZEN/REVIEW)', async () => {
		for (const state of ['READY', 'LIVE', 'FROZEN', 'REVIEW'] as const) {
			const ev = { ...event, state };
			await expect(getPublicLeaderboard(db, ev)).rejects.toBeInstanceOf(LeaderboardNotPublicError);
		}
	});

	it('serves unmasked rolls after RESULTS_PUBLISHED, excluding eliminated', async () => {
		await giveScore(pids[0], 100_000, T(10));
		await giveScore(pids[1], 80_000, T(20));
		await db.update(participants).set({ status: 'disqualified' }).where(eq(participants.id, pids[1]));
		const published = { ...event, state: 'RESULTS_PUBLISHED' as const };
		const lb = await getPublicLeaderboard(db, published);
		expect(lb.some((r) => r.participantId === pids[1])).toBe(false); // eliminated excluded
		const top = lb.find((r) => r.participantId === pids[0])!;
		expect(top.rollNumber).toBeGreaterThan(25_000_000); // unmasked
	});
});
