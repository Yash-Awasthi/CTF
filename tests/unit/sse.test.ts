import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { announcements, challenges, events, firstBloods, participants } from '../../src/lib/db/schema';
import { DEV_EVENT, seedEvent } from '../../src/lib/db/seed';
import { syncChallengeRows } from '../../src/lib/challenges/sync';
import { readUpdates, sseFrame, stateVersion } from '../../src/lib/sse';
import { getEventTiming } from '../../src/lib/event/timer';
import type { EventRow } from '../../src/lib/auth/types';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql')).sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8')).join('\n');

type Db = ReturnType<typeof drizzle>;
let db: Db;
let event: EventRow;

beforeEach(async () => {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	db = drizzle(sqlite);
	const res = await seedEvent(db, DEV_EVENT);
	await syncChallengeRows(db, res.eventId);
	event = { ...((await db.select().from(events).where(eq(events.id, res.eventId)).get()) as EventRow), startedAt: new Date('2026-07-08T10:00:00Z') };
});

describe('readUpdates diffing', () => {
	it('emits nothing new when cursors are current', async () => {
		const snap = await readUpdates(db, event, { fb: 0, ann: 0 });
		expect(snap.firstBloods).toHaveLength(0);
		expect(snap.announcements).toHaveLength(0);
	});

	it('surfaces first blood with a generic slot-only message (no solver)', async () => {
		const pid = (await db.select({ id: participants.id }).from(participants).where(eq(participants.eventId, event.id)).limit(1))[0].id;
		const ch7 = (await db.select({ id: challenges.id }).from(challenges).where(and(eq(challenges.eventId, event.id), eq(challenges.slot, 7))).get())!.id;
		await db.insert(firstBloods).values({ eventId: event.id, challengeId: ch7, participantId: pid });
		const snap = await readUpdates(db, event, { fb: 0, ann: 0 });
		expect(snap.firstBloods).toHaveLength(1);
		expect(snap.firstBloods[0].message).toBe('First blood: Q7 has been cracked.');
		// No solver identity in the payload (only id + slot + generic message).
		expect(Object.keys(snap.firstBloods[0]).sort()).toEqual(['id', 'message', 'slot']);
		expect('participantId' in snap.firstBloods[0]).toBe(false);
		void pid;
		// Advancing the cursor past it stops re-emitting.
		const next = await readUpdates(db, event, snap.cursors);
		expect(next.firstBloods).toHaveLength(0);
	});

	it('surfaces new announcements and advances the cursor', async () => {
		await db.insert(announcements).values({ eventId: event.id, message: 'hello' });
		const snap = await readUpdates(db, event, { fb: 0, ann: 0 });
		expect(snap.announcements.map((a) => a.message)).toEqual(['hello']);
		const next = await readUpdates(db, event, snap.cursors);
		expect(next.announcements).toHaveLength(0);
	});

	it('stateVersion changes on timer extension', () => {
		const v1 = stateVersion(event, getEventTiming(event));
		const extended = { ...event, durationSeconds: event.durationSeconds + 600 };
		const v2 = stateVersion(extended, getEventTiming(extended));
		expect(v1).not.toBe(v2);
	});

	it('is event-scoped (does not leak another event\'s updates)', async () => {
		const other = await seedEvent(db, { ...DEV_EVENT, slug: 'ev2' });
		await db.insert(announcements).values({ eventId: other.eventId, message: 'other-event-only' });
		const snap = await readUpdates(db, event, { fb: 0, ann: 0 });
		expect(snap.announcements).toHaveLength(0);
	});
});

describe('sseFrame formatting', () => {
	it('formats id/event/data lines', () => {
		expect(sseFrame('firstblood', { slot: 7 }, 3)).toBe('id: 3\nevent: firstblood\ndata: {"slot":7}\n\n');
		expect(sseFrame('state', { x: 1 })).toBe('event: state\ndata: {"x":1}\n\n');
	});
});
