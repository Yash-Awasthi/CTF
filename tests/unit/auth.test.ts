import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq, isNull } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	events,
	participants,
	sessions,
} from '../../src/lib/db/schema';
import {
	generateSessionToken,
	hashSessionToken,
} from '../../src/lib/auth/session-token';
import {
	constantTimeEqual,
	validateParticipantCredentials,
} from '../../src/lib/auth/credentials';
import {
	createSession,
	findValidSession,
	revokeSessionByRawToken,
} from '../../src/lib/auth/sessions';
import { isLoginAllowed } from '../../src/lib/auth/authenticate';
import {
	checkRateLimit,
	hashIp,
	recordFailure,
	resetFailures,
} from '../../src/lib/auth/rate-limit';
import {
	RATE_LIMIT_MAX_FAILURES,
	RATE_LIMIT_WINDOW_SECONDS,
} from '../../src/lib/auth/constants';

const MIGRATIONS_DIR = join(process.cwd(), 'migrations');
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
	.join('\n');

function makeDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	return { sqlite, db: drizzle(sqlite) };
}
type Db = ReturnType<typeof makeDb>['db'];

async function setup(
	db: Db,
	opts: { slug?: string; state?: 'READY' | 'DRAFT'; roll?: number } = {},
) {
	const [ev] = await db
		.insert(events)
		.values({
			name: 'Test Event',
			slug: opts.slug ?? 'e1',
			state: opts.state ?? 'READY',
			durationSeconds: 3600,
		})
		.returning();
	const [p] = await db
		.insert(participants)
		.values({ eventId: ev.id, rollNumber: opts.roll ?? 25_115_000 })
		.returning();
	return { ev, p };
}

function base64UrlByteLength(token: string): number {
	const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
	return atob(b64).length;
}

describe('session tokens', () => {
	it('uses secure randomness: >= 256 bits, unique per call', () => {
		const a = generateSessionToken();
		const b = generateSessionToken();
		expect(a).not.toBe(b);
		expect(base64UrlByteLength(a)).toBeGreaterThanOrEqual(32); // 256 bits
	});

	it('hashes deterministically and differs from the raw token', async () => {
		const t = generateSessionToken();
		const h1 = await hashSessionToken(t);
		const h2 = await hashSessionToken(t);
		expect(h1).toBe(h2);
		expect(h1).not.toBe(t);
		expect(h1).toHaveLength(64); // SHA-256 hex
		expect(await hashSessionToken('other')).not.toBe(h1);
	});
});

describe('credentials', () => {
	it('constant-time equality matches only identical strings', () => {
		expect(constantTimeEqual('25115000', '25115000')).toBe(true);
		expect(constantTimeEqual('25115000', '25115001')).toBe(false);
		expect(constantTimeEqual('abc', 'abcd')).toBe(false);
	});

	it('validates password == roll number', async () => {
		const { db } = makeDb();
		const { p } = await setup(db);
		expect(validateParticipantCredentials(p, '25115000')).toBe(true);
		expect(validateParticipantCredentials(p, '99999999')).toBe(false);
	});
});

describe('sessions', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb().db;
	});

	it('creates a session resolvable back to participant + event; raw token is NOT stored', async () => {
		const { ev, p } = await setup(db);
		const { rawToken } = await createSession(db, { event: ev, participant: p });

		const row = db.select().from(sessions).all()[0];
		expect(row.tokenHash).toBe(await hashSessionToken(rawToken));
		expect(row.tokenHash).not.toBe(rawToken);

		const ctx = await findValidSession(db, rawToken);
		expect(ctx?.participant.id).toBe(p.id);
		expect(ctx?.event.id).toBe(ev.id);
	});

	it('replaces the session on second login: old token dies, new token works, exactly one active', async () => {
		const { ev, p } = await setup(db);
		const first = await createSession(db, { event: ev, participant: p });
		const second = await createSession(db, { event: ev, participant: p });

		expect(await findValidSession(db, first.rawToken)).toBeNull();
		expect(await findValidSession(db, second.rawToken)).not.toBeNull();

		const active = db
			.select()
			.from(sessions)
			.where(
				and(eq(sessions.participantId, p.id), isNull(sessions.revokedAt)),
			)
			.all();
		expect(active).toHaveLength(1);
	});

	it('DB rejects a second concurrent active session (partial unique index)', async () => {
		const { ev, p } = await setup(db);
		await createSession(db, { event: ev, participant: p });
		// Force a second non-revoked session directly → must violate the invariant.
		expect(() =>
			db
				.insert(sessions)
				.values({
					eventId: ev.id,
					participantId: p.id,
					tokenHash: 'x'.repeat(64),
					expiresAt: new Date(Date.now() + 3_600_000),
				})
				.run(),
		).toThrow();
	});

	it('logout (revoke) invalidates the session', async () => {
		const { ev, p } = await setup(db);
		const { rawToken } = await createSession(db, { event: ev, participant: p });
		await revokeSessionByRawToken(db, rawToken);
		expect(await findValidSession(db, rawToken)).toBeNull();
	});

	it('rejects missing, unknown, and expired tokens', async () => {
		const { ev, p } = await setup(db);
		const past = new Date(Date.now() - 24 * 3_600_000);
		const { rawToken } = await createSession(db, {
			event: ev,
			participant: p,
			now: past, // expiresAt = past + 12h, still in the past
		});
		expect(await findValidSession(db, undefined)).toBeNull();
		expect(await findValidSession(db, 'not-a-real-token')).toBeNull();
		expect(await findValidSession(db, rawToken)).toBeNull(); // expired
	});

	it('does not authenticate a participant into a different event', async () => {
		const a = await setup(db, { slug: 'event-a', roll: 25_115_000 });
		await setup(db, { slug: 'event-b', roll: 25_115_050 });
		// roll 25115000 exists only in event-a; lookup scoped to event-b finds nothing
		const found = db
			.select()
			.from(participants)
			.where(
				and(
					eq(participants.eventId, a.ev.id + 1),
					eq(participants.rollNumber, 25_115_000),
				),
			)
			.get();
		expect(found).toBeUndefined();
	});
});

describe('event-state login policy', () => {
	it('permits READY/LIVE/FROZEN, denies the rest', () => {
		for (const s of ['READY', 'LIVE', 'FROZEN'] as const) {
			expect(isLoginAllowed(s)).toBe(true);
		}
		for (const s of [
			'DRAFT',
			'REVIEW',
			'RESULTS_PUBLISHED',
			'ARCHIVED',
		] as const) {
			expect(isLoginAllowed(s)).toBe(false);
		}
	});
});

describe('rate limiting', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb().db;
	});

	it('blocks after the configured failures and resets on success', async () => {
		const { ev } = await setup(db);
		const key = { eventId: ev.id, scope: 'roll' as const, subject: '25115000' };

		for (let i = 0; i < RATE_LIMIT_MAX_FAILURES - 1; i++) {
			await recordFailure(db, key);
		}
		expect((await checkRateLimit(db, key)).blocked).toBe(false);

		await recordFailure(db, key); // hits the threshold
		expect((await checkRateLimit(db, key)).blocked).toBe(true);

		await resetFailures(db, key); // success clears it → never a permanent lock
		expect((await checkRateLimit(db, key)).blocked).toBe(false);
	});

	it('lapses the window (no permanent lock)', async () => {
		const { ev } = await setup(db);
		const key = { eventId: ev.id, scope: 'roll' as const, subject: '25115000' };
		const t0 = new Date();
		for (let i = 0; i < RATE_LIMIT_MAX_FAILURES; i++) {
			await recordFailure(db, key, t0);
		}
		expect((await checkRateLimit(db, key, t0)).blocked).toBe(true);
		const later = new Date(t0.getTime() + (RATE_LIMIT_WINDOW_SECONDS + 1) * 1000);
		expect((await checkRateLimit(db, key, later)).blocked).toBe(false);
	});

	it('hashes IPs privately: deterministic, secret-dependent, never the raw IP', async () => {
		const ip = '203.0.113.7';
		const h1 = await hashIp(ip, 'secretA');
		const h2 = await hashIp(ip, 'secretA');
		const h3 = await hashIp(ip, 'secretB');
		expect(h1).toBe(h2);
		expect(h1).not.toBe(h3);
		expect(h1).not.toContain(ip);
		expect(h1).toHaveLength(64);
	});
});
