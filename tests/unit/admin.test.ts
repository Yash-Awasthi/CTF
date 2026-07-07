import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	adminActions,
	announcements,
	challengeBypasses,
	challenges,
	events,
	participants,
	sessions,
	solves,
} from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import {
	timingSafeEqual,
	verifyAdminPassword,
	createAdminSession,
	isValidAdminSession,
	revokeAdminSession,
	checkAdminRateLimit,
	recordAdminFailure,
	resetAdminFailures,
	bypassChallenge,
	createAnnouncement,
	listAnnouncements,
	resetParticipantSession,
} from '../../src/lib/admin';
import { adminSessions } from '../../src/lib/db/schema';
import { hashSessionToken } from '../../src/lib/auth/session-token';
import { extendEvent, startEvent, markEventReady } from '../../src/lib/event/state';
import type { EventRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql')).sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8')).join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let event: EventRow;
let pids: number[];

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	event = (await db.select().from(events).where(eq(events.id, res.eventId)).get()) as EventRow;
	pids = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, event.id)).orderBy(participants.rollNumber).limit(3)).map((p) => p.id);
});

describe('admin auth + opaque sessions', () => {
	it('password verification is constant-time and correct', () => {
		expect(verifyAdminPassword({ ADMIN_SECRET: 'secret' }, 'secret')).toBe(true);
		expect(verifyAdminPassword({ ADMIN_SECRET: 'secret' }, 'wrong')).toBe(false);
		expect(verifyAdminPassword({ ADMIN_SECRET: '' }, '')).toBe(false);
		expect(timingSafeEqual('a', 'a')).toBe(true);
		expect(timingSafeEqual('a', 'b')).toBe(false);
	});

	it('creates an opaque session; raw token never stored, only its hash', async () => {
		const { rawToken } = await createAdminSession(db);
		expect(rawToken.length).toBeGreaterThanOrEqual(43); // 256-bit base64url
		const rows = await db.select().from(adminSessions);
		expect(rows).toHaveLength(1);
		expect(rows[0].tokenHash).not.toBe(rawToken); // raw not persisted
		expect(rows[0].tokenHash).toBe(await hashSessionToken(rawToken)); // hash stored
	});

	it('two logins mint different raw tokens', async () => {
		const a = await createAdminSession(db);
		const b = await createAdminSession(db);
		expect(a.rawToken).not.toBe(b.rawToken);
	});

	it('valid session authenticates; unknown/garbage does not', async () => {
		const { rawToken } = await createAdminSession(db);
		expect(await isValidAdminSession(db, rawToken)).toBe(true);
		expect(await isValidAdminSession(db, 'garbage')).toBe(false);
		expect(await isValidAdminSession(db, undefined)).toBe(false);
	});

	it('expired session is rejected', async () => {
		const now = new Date('2026-07-08T10:00:00Z');
		const { rawToken } = await createAdminSession(db, now);
		const later = new Date(now.getTime() + 13 * 60 * 60 * 1000); // >12h
		expect(await isValidAdminSession(db, rawToken, later)).toBe(false);
	});

	it('revoked session (logout) is rejected', async () => {
		const { rawToken } = await createAdminSession(db);
		await revokeAdminSession(db, rawToken);
		expect(await isValidAdminSession(db, rawToken)).toBe(false);
	});

	it('a participant session token never authenticates as admin', async () => {
		// Participant session hash lives in a DIFFERENT table → not admin.
		const raw = 'participant-raw-token';
		await db.insert(sessions).values({
			eventId: event.id, participantId: pids[0], tokenHash: await hashSessionToken(raw), expiresAt: new Date(Date.now() + 3_600_000),
		});
		expect(await isValidAdminSession(db, raw)).toBe(false);
	});
});

describe('admin login rate limiting', () => {
	it('blocks after MAX failures within the window, resets on success', async () => {
		const ipHash = 'iphash-1';
		for (let i = 0; i < 10; i++) await recordAdminFailure(db, ipHash);
		expect((await checkAdminRateLimit(db, ipHash)).blocked).toBe(true);
		await resetAdminFailures(db, ipHash);
		expect((await checkAdminRateLimit(db, ipHash)).blocked).toBe(false);
	});
});

describe('session reset', () => {
	it('revokes the active session but preserves all progress', async () => {
		// Give the participant a session + score + a solve.
		await db.insert(sessions).values({ eventId: event.id, participantId: pids[0], tokenHash: 'hash-1', expiresAt: new Date(Date.now() + 3_600_000) });
		const ch1 = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, event.id), eq(challenges.slot, 1))).get())!.id;
		await db.insert(solves).values({ eventId: event.id, participantId: pids[0], challengeId: ch1, timeFactor: 1000, hintFactor: 1000, finalScore: 100_000 });
		await db.update(participants).set({ score: 100_000, currentChallenge: 2 }).where(eq(participants.id, pids[0]));

		const r = await resetParticipantSession(db, { eventId: event.id, participantId: pids[0] });
		expect(r.revoked).toBe(1);

		const active = await db.select().from(sessions).where(and(eq(sessions.participantId, pids[0]), isNull(sessions.revokedAt)));
		expect(active).toHaveLength(0); // session revoked
		const p = await db.select().from(participants).where(eq(participants.id, pids[0])).get();
		expect(p?.score).toBe(100_000); // progress preserved
		expect(p?.currentChallenge).toBe(2);
		const solveRows = await db.select().from(solves).where(eq(solves.participantId, pids[0]));
		expect(solveRows).toHaveLength(1);
		const audit = await db.select().from(adminActions).where(eq(adminActions.actionType, 'admin_session_reset'));
		expect(audit).toHaveLength(1);
	});
});

describe('challenge bypass', () => {
	it('advances stuck participants without solve/score/first-blood, and audits', async () => {
		await db.update(participants).set({ currentChallenge: 5 }).where(eq(participants.id, pids[0]));
		await db.update(participants).set({ currentChallenge: 5 }).where(eq(participants.id, pids[1]));
		await db.update(participants).set({ currentChallenge: 3 }).where(eq(participants.id, pids[2]));

		const r = await bypassChallenge(db, { eventId: event.id, slot: 5, reason: 'broken asset' });
		expect(r.advanced).toBe(2); // only the two stuck at slot 5

		const p0 = await db.select().from(participants).where(eq(participants.id, pids[0])).get();
		expect(p0?.currentChallenge).toBe(6);
		const p2 = await db.select().from(participants).where(eq(participants.id, pids[2])).get();
		expect(p2?.currentChallenge).toBe(3); // untouched

		expect(await db.select().from(solves).where(eq(solves.eventId, event.id))).toHaveLength(0); // NO fake solve
		expect(await db.select().from(challengeBypasses).where(eq(challengeBypasses.eventId, event.id))).toHaveLength(1);
		expect(await db.select().from(adminActions).where(eq(adminActions.actionType, 'admin_challenge_bypass'))).toHaveLength(1);
	});
});

describe('announcements', () => {
	it('persist event-scoped and audited', async () => {
		await createAnnouncement(db, { eventId: event.id, message: 'Q3 asset re-uploaded' });
		const rows = await listAnnouncements(db, event.id);
		expect(rows).toHaveLength(1);
		expect(rows[0].message).toBe('Q3 asset re-uploaded');
		expect(await db.select().from(announcements).where(eq(announcements.eventId, event.id))).toHaveLength(1);
		expect(await db.select().from(adminActions).where(eq(adminActions.actionType, 'admin_announcement'))).toHaveLength(1);
	});
});

describe('timer extension cap (reuses Phase 3 service)', () => {
	it('extends while LIVE and enforces the 6h cap', async () => {
		await markEventReady(db, event.id);
		await startEvent(db, event.id);
		await extendEvent(db, event.id, 3600); // ok
		const ev = await db.select().from(events).where(eq(events.id, event.id)).get();
		expect(ev!.durationSeconds).toBe(DEV_EVENT.durationSeconds + 3600);
		// Pushing past 21600 total must be rejected.
		await expect(extendEvent(db, event.id, 21_600)).rejects.toThrow(/exceeds_max_duration/);
	});
});
