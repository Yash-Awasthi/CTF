import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { adminActions, events } from '../../src/lib/db/schema';
import type { EventRow } from '../../src/lib/auth/types';
import { getEventTiming } from '../../src/lib/event/timer';
import {
	archiveEvent,
	beginEventReview,
	ensureCurrentEventState,
	extendEvent,
	freezeEvent,
	markEventReady,
	publishEventResults,
	setEventDuration,
	startEvent,
} from '../../src/lib/event/state';
import {
	canAccessCompetition,
	canAccessWaitingRoom,
	canParticipantLogin,
	canViewFinalResults,
} from '../../src/lib/event/access';
import {
	EVENT_ACTIONS,
	MAX_EVENT_DURATION_SECONDS,
	type EventState,
} from '../../src/lib/event/constants';

const MIGRATION_SQL = readdirSync(join(process.cwd(), 'migrations'))
	.filter((f) => f.endsWith('.sql'))
	.sort()
	.map((f) => readFileSync(join(process.cwd(), 'migrations', f), 'utf8'))
	.join('\n');

function makeDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	sqlite.exec(MIGRATION_SQL);
	return drizzle(sqlite);
}
type Db = ReturnType<typeof makeDb>;

async function insertEvent(
	db: Db,
	opts: { state?: EventState; durationSeconds?: number; startedAt?: Date; slug?: string } = {},
): Promise<EventRow> {
	const [ev] = await db
		.insert(events)
		.values({
			name: 'E',
			slug: opts.slug ?? 'e1',
			state: opts.state ?? 'DRAFT',
			durationSeconds: opts.durationSeconds ?? 3600,
			startedAt: opts.startedAt ?? null,
		})
		.returning();
	return ev;
}

function auditCount(db: Db, actionType: string): number {
	return db.select().from(adminActions).all().filter((a) => a.actionType === actionType).length;
}

describe('lifecycle transitions', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb();
	});

	it('walks the full forward path', async () => {
		const ev = await insertEvent(db, { state: 'DRAFT' });
		expect((await markEventReady(db, ev.id)).state).toBe('READY');
		expect((await startEvent(db, ev.id)).state).toBe('LIVE');
		expect((await freezeEvent(db, ev.id)).state).toBe('FROZEN');
		expect((await beginEventReview(db, ev.id)).state).toBe('REVIEW');
		expect((await publishEventResults(db, ev.id)).state).toBe('RESULTS_PUBLISHED');
		expect((await archiveEvent(db, ev.id)).state).toBe('ARCHIVED');
	});

	it('rejects skips, backward, same-state, and from-ARCHIVED', async () => {
		const ev = await insertEvent(db, { state: 'DRAFT' });
		await expect(startEvent(db, ev.id)).rejects.toThrow(); // skip READY
		await expect(freezeEvent(db, ev.id)).rejects.toThrow(); // skip
		await markEventReady(db, ev.id);
		await expect(markEventReady(db, ev.id)).rejects.toThrow(); // same-state
		await startEvent(db, ev.id);
		await expect(markEventReady(db, ev.id)).rejects.toThrow(); // backward
		await freezeEvent(db, ev.id);
		await beginEventReview(db, ev.id);
		await publishEventResults(db, ev.id);
		await archiveEvent(db, ev.id);
		await expect(beginEventReview(db, ev.id)).rejects.toThrow(); // from ARCHIVED
	});
});

describe('start behavior', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb();
	});

	it('sets started_at, preserves duration, derives end, cannot start twice or from DRAFT', async () => {
		const draft = await insertEvent(db, { state: 'DRAFT', durationSeconds: 3600 });
		await expect(startEvent(db, draft.id)).rejects.toThrow();

		const ev = await insertEvent(db, { state: 'READY', durationSeconds: 3600, slug: 'e2' });
		const now = new Date(1_000_000_000_000);
		const timing = await startEvent(db, ev.id, undefined, now);
		expect(timing.hasStarted).toBe(true);
		expect(timing.startedAt).toBe(Math.floor(now.getTime() / 1000));
		expect(timing.durationSeconds).toBe(3600);
		expect(timing.endsAt).toBe(timing.startedAt! + 3600);
		expect(timing.isLive).toBe(true);

		await expect(startEvent(db, ev.id)).rejects.toThrow(); // twice
	});
});

describe('timer derivation', () => {
	it('READY: not started, no active countdown', async () => {
		const db = makeDb();
		const ev = await insertEvent(db, { state: 'READY', durationSeconds: 3600 });
		const t = getEventTiming(ev, new Date());
		expect(t.hasStarted).toBe(false);
		expect(t.isLive).toBe(false);
		expect(t.elapsedSeconds).toBe(0);
		expect(t.remainingSeconds).toBe(3600);
	});

	it('LIVE: elapsed/remaining correct, remaining never negative, expiry reports ended', async () => {
		const db = makeDb();
		const start = new Date(2_000_000_000_000);
		const ev = await insertEvent(db, { state: 'LIVE', durationSeconds: 3600, startedAt: start });
		const mid = new Date(start.getTime() + 600_000); // +10 min
		let t = getEventTiming(ev, mid);
		expect(t.elapsedSeconds).toBe(600);
		expect(t.remainingSeconds).toBe(3000);
		expect(t.isLive).toBe(true);
		expect(t.hasEnded).toBe(false);

		const after = new Date(start.getTime() + 4_000_000); // past end
		t = getEventTiming(ev, after);
		expect(t.remainingSeconds).toBe(0);
		expect(t.isLive).toBe(false);
		expect(t.hasEnded).toBe(true);
	});

	it('FROZEN reports ended', async () => {
		const db = makeDb();
		const ev = await insertEvent(db, { state: 'FROZEN', durationSeconds: 3600, startedAt: new Date() });
		expect(getEventTiming(ev, new Date()).hasEnded).toBe(true);
		expect(getEventTiming(ev, new Date()).isLive).toBe(false);
	});
});

describe('automatic lazy expiry', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb();
	});

	it('freezes an expired LIVE event, audits exactly once, idempotent under repeat', async () => {
		const start = new Date(1_500_000_000_000);
		const ev = await insertEvent(db, { state: 'LIVE', durationSeconds: 60, startedAt: start });
		const after = new Date(start.getTime() + 120_000);

		const first = await ensureCurrentEventState(db, ev, after);
		expect(first.state).toBe('FROZEN');
		// Re-read fresh row and refresh again → still FROZEN, no extra audit.
		const reread = db.select().from(events).where(eq(events.id, ev.id)).get()!;
		const second = await ensureCurrentEventState(db, reread, after);
		expect(second.state).toBe('FROZEN');

		expect(auditCount(db, EVENT_ACTIONS.autoFreeze)).toBe(1);
	});

	it('does not freeze a still-running LIVE event', async () => {
		const start = new Date(1_500_000_000_000);
		const ev = await insertEvent(db, { state: 'LIVE', durationSeconds: 3600, startedAt: start });
		const soon = new Date(start.getTime() + 60_000);
		expect((await ensureCurrentEventState(db, ev, soon)).state).toBe('LIVE');
		expect(auditCount(db, EVENT_ACTIONS.autoFreeze)).toBe(0);
	});
});

describe('extension', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb();
	});

	async function liveEvent(durationSeconds: number) {
		const ev = await insertEvent(db, { state: 'READY', durationSeconds });
		await startEvent(db, ev.id, undefined, new Date(1_600_000_000_000));
		return ev;
	}

	it('adds positive time within the 6h total, updates end + audits', async () => {
		const ev = await liveEvent(3600);
		const now = new Date(1_600_000_060_000);
		const t = await extendEvent(db, ev.id, 1800, undefined, now);
		expect(t.durationSeconds).toBe(5400);
		expect(t.endsAt).toBe(t.startedAt! + 5400);
		expect(auditCount(db, EVENT_ACTIONS.extended)).toBe(1);
	});

	it('rejects zero, negative, over-cap, and non-LIVE extensions', async () => {
		const ev = await liveEvent(5 * 3600);
		await expect(extendEvent(db, ev.id, 0)).rejects.toThrow();
		await expect(extendEvent(db, ev.id, -60)).rejects.toThrow();
		await expect(extendEvent(db, ev.id, MAX_EVENT_DURATION_SECONDS)).rejects.toThrow(); // 5h + max > cap
		expect(5 * 3600 + MAX_EVENT_DURATION_SECONDS).toBeGreaterThan(MAX_EVENT_DURATION_SECONDS);

		const draft = await insertEvent(db, { state: 'DRAFT', slug: 'd' });
		await expect(extendEvent(db, draft.id, 60)).rejects.toThrow(); // non-LIVE
	});
});

describe('duration configuration', () => {
	let db: Db;
	beforeEach(() => {
		db = makeDb();
	});

	it('allows in DRAFT/READY, rejects invalid, rejects >6h, locks after LIVE', async () => {
		const ev = await insertEvent(db, { state: 'DRAFT' });
		expect((await setEventDuration(db, ev.id, 7200)).durationSeconds).toBe(7200);
		await markEventReady(db, ev.id);
		expect((await setEventDuration(db, ev.id, 3600)).durationSeconds).toBe(3600);
		await expect(setEventDuration(db, ev.id, 0)).rejects.toThrow();
		await expect(setEventDuration(db, ev.id, MAX_EVENT_DURATION_SECONDS + 1)).rejects.toThrow();
		await startEvent(db, ev.id);
		await expect(setEventDuration(db, ev.id, 3600)).rejects.toThrow(); // locked after LIVE
	});
});

describe('secret_version stability after LIVE', () => {
	it('is not changed by start or extend', async () => {
		const db = makeDb();
		const ev = await insertEvent(db, { state: 'READY', durationSeconds: 3600 });
		const before = ev.secretVersion;
		await startEvent(db, ev.id, undefined, new Date(1_700_000_000_000));
		await extendEvent(db, ev.id, 600, undefined, new Date(1_700_000_060_000));
		const after = db.select().from(events).where(eq(events.id, ev.id)).get()!;
		expect(after.secretVersion).toBe(before);
	});
});

describe('access policies', () => {
	it('encodes the per-state matrix', () => {
		expect(canParticipantLogin('DRAFT')).toBe(false);
		expect(canParticipantLogin('READY')).toBe(true);
		expect(canParticipantLogin('LIVE')).toBe(true);
		expect(canParticipantLogin('FROZEN')).toBe(true);
		expect(canAccessWaitingRoom('READY')).toBe(true);
		expect(canAccessWaitingRoom('LIVE')).toBe(false);
		expect(canViewFinalResults('RESULTS_PUBLISHED')).toBe(true);
		expect(canViewFinalResults('FROZEN')).toBe(false);
	});

	it('competition access follows authoritative time, not just state', async () => {
		const db = makeDb();
		const start = new Date(1_800_000_000_000);
		const live = await insertEvent(db, { state: 'LIVE', durationSeconds: 3600, startedAt: start });
		expect(canAccessCompetition(live, new Date(start.getTime() + 60_000))).toBe(true);
		expect(canAccessCompetition(live, new Date(start.getTime() + 4_000_000))).toBe(false); // expired
		const draft = await insertEvent(db, { state: 'DRAFT', slug: 'd2' });
		expect(canAccessCompetition(draft, new Date())).toBe(false);
	});
});

describe('audit metadata', () => {
	it('records before/after values and distinguishes manual vs automatic freeze', async () => {
		const db = makeDb();
		const ev = await insertEvent(db, { state: 'READY', durationSeconds: 60 });
		await startEvent(db, ev.id, undefined, new Date(1_900_000_000_000));
		await freezeEvent(db, ev.id); // manual
		const rows = db.select().from(adminActions).all();
		const manual = rows.find((r) => r.actionType === EVENT_ACTIONS.manualFreeze);
		expect(manual).toBeTruthy();
		const meta = JSON.parse(manual!.payload!);
		expect(meta.oldState).toBe('LIVE');
		expect(meta.newState).toBe('FROZEN');

		// automatic on a separate expired event
		const ev2 = await insertEvent(db, { state: 'LIVE', durationSeconds: 60, startedAt: new Date(1_900_000_000_000), slug: 'e-auto' });
		await ensureCurrentEventState(db, ev2, new Date(1_900_000_120_000));
		expect(auditCount(db, EVENT_ACTIONS.autoFreeze)).toBe(1);
		expect(auditCount(db, EVENT_ACTIONS.manualFreeze)).toBe(1);
	});
});
