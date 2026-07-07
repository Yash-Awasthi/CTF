import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { challenges, events, participants, solves } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import {
	getChallengeSolveCounts,
	getLeaderboard,
	getSolveHistory,
	recomputeParticipantScore,
	recordSolve,
	verifyParticipantScore,
} from '../../src/lib/scoring/aggregate';
import type { EventRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8'))
	.join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let event: EventRow;
let participantIds: number[];
let challengeBySlot: Map<number, { id: number; basePoints: number }>;

const STARTED = new Date('2026-07-08T10:00:00Z');

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);

	// Load the seeded event and pin an authoritative start time (LIVE-like).
	const seededEvent = await db
		.select()
		.from(events)
		.where(eq(events.id, res.eventId))
		.get();
	event = { ...(seededEvent as EventRow), startedAt: STARTED };

	const ps = await db
		.select({ id: participants.id })
		.from(participants)
		.where(eq(participants.eventId, res.eventId))
		.orderBy(participants.rollNumber);
	participantIds = ps.map((p) => p.id);

	const cs = await db
		.select({ id: challenges.id, slot: challenges.slot, basePoints: challenges.basePoints })
		.from(challenges)
		.where(eq(challenges.eventId, res.eventId));
	challengeBySlot = new Map(cs.map((c) => [c.slot, { id: c.id, basePoints: c.basePoints }]));
});

function ch(slot: number) {
	return challengeBySlot.get(slot)!;
}

describe('recordSolve persistence + idempotency', () => {
	it('writes one scored solve and increments the cached total', async () => {
		const solvedAt = new Date(STARTED.getTime()); // elapsed 0 → full
		const c = ch(1); // base 100
		const r = await recordSolve(db, {
			event,
			participantId: participantIds[0],
			challengeId: c.id,
			basePoints: c.basePoints,
			hintUsed: false,
			solvedAt,
		});
		expect(r.created).toBe(true);
		expect(r.score.finalScore).toBe(100_000);

		const p = await db
			.select({ score: participants.score })
			.from(participants)
			.where(eq(participants.id, participantIds[0]))
			.get();
		expect(p?.score).toBe(100_000);
	});

	it('does not double-add on a repeated solve attempt', async () => {
		const c = ch(1);
		const base = {
			event,
			participantId: participantIds[0],
			challengeId: c.id,
			basePoints: c.basePoints,
			hintUsed: false,
			solvedAt: STARTED,
		};
		const first = await recordSolve(db, base);
		const second = await recordSolve(db, { ...base, solvedAt: new Date(STARTED.getTime() + 999_000) });
		expect(first.created).toBe(true);
		expect(second.created).toBe(false);

		const rows = await db
			.select()
			.from(solves)
			.where(and(eq(solves.participantId, participantIds[0]), eq(solves.challengeId, c.id)));
		expect(rows).toHaveLength(1);
		const p = await db.select({ score: participants.score }).from(participants).where(eq(participants.id, participantIds[0])).get();
		expect(p?.score).toBe(100_000); // unchanged by the second attempt
	});

	it('participant total equals sum of solve milli-points', async () => {
		const pid = participantIds[0];
		await recordSolve(db, { event, participantId: pid, challengeId: ch(1).id, basePoints: ch(1).basePoints, hintUsed: false, solvedAt: STARTED });
		await recordSolve(db, { event, participantId: pid, challengeId: ch(2).id, basePoints: ch(2).basePoints, hintUsed: true, solvedAt: STARTED });
		const check = await verifyParticipantScore(db, event.id, pid);
		expect(check.consistent).toBe(true);
		expect(check.cached).toBe(check.recomputed);
		const recomputed = await recomputeParticipantScore(db, event.id, pid);
		expect(check.cached).toBe(recomputed);
	});

	it('persists integers only (no floats) for score fields', async () => {
		const pid = participantIds[0];
		await recordSolve(db, { event, participantId: pid, challengeId: ch(3).id, basePoints: ch(3).basePoints, hintUsed: true, solvedAt: new Date(STARTED.getTime() + 1234_000) });
		const solveRow = await db.select().from(solves).where(eq(solves.participantId, pid)).get();
		for (const v of [solveRow!.finalScore, solveRow!.timeFactor, solveRow!.hintFactor]) {
			expect(typeof v).toBe('number');
			expect(Number.isInteger(v)).toBe(true);
		}
		const p = await db.select({ score: participants.score }).from(participants).where(eq(participants.id, pid)).get();
		expect(Number.isInteger(p!.score)).toBe(true);
	});
});

describe('leaderboard + query paths', () => {
	it('orders by persisted score desc', async () => {
		await recordSolve(db, { event, participantId: participantIds[0], challengeId: ch(1).id, basePoints: 100, hintUsed: false, solvedAt: STARTED });
		// duration = 14400s (DEV_EVENT). elapsed 1800s → tf=(28800-1800)/28800=0.9375 → 93750
		await recordSolve(db, { event, participantId: participantIds[1], challengeId: ch(1).id, basePoints: 100, hintUsed: false, solvedAt: new Date(STARTED.getTime() + 1_800_000) });
		const lb = await getLeaderboard(db, event.id);
		expect(lb[0].participantId).toBe(participantIds[0]); // 100000 > 93750
		expect(lb[0].score).toBe(100_000);
		expect(lb[1].participantId).toBe(participantIds[1]);
		expect(lb[1].score).toBe(93_750);
		// participants with no solves sort last with score 0
		expect(lb[lb.length - 1].score).toBe(0);
	});

	it('tie → earliest final-solve timestamp wins (build-plan fallback)', async () => {
		// Construct an exact score tie with different last-solve times directly.
		const early = participantIds[0];
		const late = participantIds[1];
		const t1 = new Date(STARTED.getTime() + 100_000);
		const t2 = new Date(STARTED.getTime() + 200_000);
		for (const [pid, at] of [[early, t1], [late, t2]] as const) {
			await db.insert(solves).values({ eventId: event.id, participantId: pid, challengeId: ch(5).id, solvedAt: at, timeFactor: 900, hintFactor: 1000, finalScore: 90_000 });
			await db.update(participants).set({ score: 90_000 }).where(eq(participants.id, pid));
		}
		const lb = await getLeaderboard(db, event.id);
		const tied = lb.filter((r) => r.score === 90_000);
		expect(tied[0].participantId).toBe(early); // earlier lastSolveAt ranks first
		expect(tied[1].participantId).toBe(late);
	});

	it('solve history + per-challenge counts', async () => {
		await recordSolve(db, { event, participantId: participantIds[0], challengeId: ch(1).id, basePoints: 100, hintUsed: false, solvedAt: STARTED });
		await recordSolve(db, { event, participantId: participantIds[1], challengeId: ch(1).id, basePoints: 100, hintUsed: false, solvedAt: STARTED });
		const history = await getSolveHistory(db, event.id, participantIds[0]);
		expect(history).toHaveLength(1);
		const counts = await getChallengeSolveCounts(db, event.id);
		expect(counts.get(ch(1).id)).toBe(2);
	});
});
