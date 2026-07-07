import { and, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { adminActions, events } from '../db/schema';
import type { EventRow } from '../auth/types';
import {
	ACTOR_ADMIN,
	ACTOR_SYSTEM,
	EVENT_ACTIONS,
	EVENT_TRANSITIONS,
	MAX_EVENT_DURATION_SECONDS,
	type EventState,
} from './constants';
import { getEventTiming } from './timer';
import type { EventTiming } from './types';

// ── internals ───────────────────────────────────────────────────────────────

async function loadEvent(db: AnySQLiteDb, eventId: number): Promise<EventRow> {
	const row = await db.select().from(events).where(eq(events.id, eventId)).get();
	if (!row) throw new Error('event_not_found');
	return row;
}

async function audit(
	db: AnySQLiteDb,
	args: {
		eventId: number;
		actionType: string;
		actor: string;
		metadata?: Record<string, unknown>;
	},
): Promise<void> {
	await db.insert(adminActions).values({
		eventId: args.eventId,
		actionType: args.actionType,
		actor: args.actor,
		payload: args.metadata ? JSON.stringify(args.metadata) : null,
	});
}

/**
 * Forward-only transition via a CONDITIONAL update (`WHERE state = <from>`), so
 * only one caller wins under concurrency. Rejects skips/backward/self/from-ARCHIVED.
 */
async function advance(
	db: AnySQLiteDb,
	eventId: number,
	to: EventState,
	actionType: string,
	actor: string,
	extraMeta?: Record<string, unknown>,
): Promise<EventRow> {
	const event = await loadEvent(db, eventId);
	if (EVENT_TRANSITIONS[event.state] !== to) {
		throw new Error(`invalid_transition:${event.state}->${to}`);
	}
	const updated = await db
		.update(events)
		.set({ state: to })
		.where(and(eq(events.id, eventId), eq(events.state, event.state)))
		.returning();
	if (updated.length === 0) throw new Error('transition_conflict');

	await audit(db, {
		eventId,
		actionType,
		actor,
		metadata: { oldState: event.state, newState: to, ...extraMeta },
	});
	return loadEvent(db, eventId);
}

// ── lifecycle operations ────────────────────────────────────────────────────

export function markEventReady(db: AnySQLiteDb, eventId: number, actor = ACTOR_ADMIN) {
	return advance(db, eventId, 'READY', EVENT_ACTIONS.markedReady, actor);
}

/** READY → LIVE, atomically stamping the authoritative server start time. */
export async function startEvent(
	db: AnySQLiteDb,
	eventId: number,
	actor = ACTOR_ADMIN,
	now: Date = new Date(),
): Promise<EventTiming> {
	const event = await loadEvent(db, eventId);
	if (event.state !== 'READY') {
		throw new Error(`invalid_transition:${event.state}->LIVE`);
	}
	const updated = await db
		.update(events)
		.set({ state: 'LIVE', startedAt: now })
		.where(and(eq(events.id, eventId), eq(events.state, 'READY')))
		.returning();
	if (updated.length === 0) throw new Error('transition_conflict');

	await audit(db, {
		eventId,
		actionType: EVENT_ACTIONS.started,
		actor,
		metadata: {
			oldState: 'READY',
			newState: 'LIVE',
			startedAt: Math.floor(now.getTime() / 1000),
			durationSeconds: event.durationSeconds,
		},
	});
	return getEventTiming(await loadEvent(db, eventId), now);
}

/** Manual LIVE → FROZEN before natural expiry. */
export function freezeEvent(db: AnySQLiteDb, eventId: number, actor = ACTOR_ADMIN) {
	return advance(db, eventId, 'FROZEN', EVENT_ACTIONS.manualFreeze, actor);
}

export function beginEventReview(db: AnySQLiteDb, eventId: number, actor = ACTOR_ADMIN) {
	return advance(db, eventId, 'REVIEW', EVENT_ACTIONS.reviewStarted, actor);
}

export function publishEventResults(db: AnySQLiteDb, eventId: number, actor = ACTOR_ADMIN) {
	return advance(db, eventId, 'RESULTS_PUBLISHED', EVENT_ACTIONS.resultsPublished, actor);
}

export function archiveEvent(db: AnySQLiteDb, eventId: number, actor = ACTOR_ADMIN) {
	return advance(db, eventId, 'ARCHIVED', EVENT_ACTIONS.archived, actor);
}

/**
 * Configure duration pre-start (DRAFT/READY only). After LIVE, duration changes
 * only via extendEvent(). secret_version is never touched here.
 */
export async function setEventDuration(
	db: AnySQLiteDb,
	eventId: number,
	durationSeconds: number,
	actor = ACTOR_ADMIN,
): Promise<EventRow> {
	const event = await loadEvent(db, eventId);
	if (event.state !== 'DRAFT' && event.state !== 'READY') {
		throw new Error('duration_locked_after_live');
	}
	if (
		!Number.isInteger(durationSeconds) ||
		durationSeconds <= 0 ||
		durationSeconds > MAX_EVENT_DURATION_SECONDS
	) {
		throw new Error('invalid_duration');
	}
	await db
		.update(events)
		.set({ durationSeconds })
		.where(eq(events.id, eventId));
	await audit(db, {
		eventId,
		actionType: EVENT_ACTIONS.durationChanged,
		actor,
		metadata: {
			oldDurationSeconds: event.durationSeconds,
			newDurationSeconds: durationSeconds,
		},
	});
	return loadEvent(db, eventId);
}

/**
 * Extend a LIVE event by adding seconds to the canonical duration_seconds,
 * capped at the 6-hour TOTAL maximum. Rejects non-LIVE / non-positive / over-cap.
 */
export async function extendEvent(
	db: AnySQLiteDb,
	eventId: number,
	additionalSeconds: number,
	actor = ACTOR_ADMIN,
	now: Date = new Date(),
): Promise<EventTiming> {
	// Refresh first so an already-expired LIVE event is FROZEN → extension rejected.
	const event = await ensureCurrentEventState(db, await loadEvent(db, eventId), now);
	if (event.state !== 'LIVE') throw new Error('not_live');
	if (!Number.isInteger(additionalSeconds) || additionalSeconds <= 0) {
		throw new Error('invalid_extension');
	}
	const newDuration = event.durationSeconds + additionalSeconds;
	if (newDuration > MAX_EVENT_DURATION_SECONDS) {
		throw new Error('exceeds_max_duration');
	}
	await db
		.update(events)
		.set({ durationSeconds: newDuration })
		.where(and(eq(events.id, eventId), eq(events.state, 'LIVE')));
	await audit(db, {
		eventId,
		actionType: EVENT_ACTIONS.extended,
		actor,
		metadata: {
			oldDurationSeconds: event.durationSeconds,
			newDurationSeconds: newDuration,
			extensionSeconds: additionalSeconds,
		},
	});
	return getEventTiming(await loadEvent(db, eventId), now);
}

/**
 * Lazy authoritative expiry: if a LIVE event's end time has passed, atomically
 * transition it to FROZEN (conditional update → exactly one winner audits the
 * automatic_expiry). Idempotent; safe under concurrent calls. Any operation that
 * depends on event state should route through this first.
 */
export async function ensureCurrentEventState(
	db: AnySQLiteDb,
	event: EventRow,
	now: Date = new Date(),
): Promise<EventRow> {
	if (event.state !== 'LIVE' || !event.startedAt) return event;

	const endsAt = Math.floor(event.startedAt.getTime() / 1000) + event.durationSeconds;
	if (Math.floor(now.getTime() / 1000) < endsAt) return event;

	const frozen = await db
		.update(events)
		.set({ state: 'FROZEN' })
		.where(and(eq(events.id, event.id), eq(events.state, 'LIVE')))
		.returning();
	if (frozen.length > 0) {
		await audit(db, {
			eventId: event.id,
			actionType: EVENT_ACTIONS.autoFreeze,
			actor: ACTOR_SYSTEM,
			metadata: { oldState: 'LIVE', newState: 'FROZEN', endsAt },
		});
	}
	return loadEvent(db, event.id);
}
