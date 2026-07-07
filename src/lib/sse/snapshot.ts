/**
 * Phase 12 live updates — D1 is the single source of truth. There is NO
 * module-global broadcaster (Cloudflare Workers are multi-isolate; an in-memory
 * subscriber map would not be globally reliable). Instead every SSE stream (and
 * the polling fallback) READS authoritative D1 state and diffs against the
 * client's cursors. Missed events are always recoverable from D1 on reconnect.
 *
 * Payloads are minimal + typed: event-state/timing, first-blood (challenge slot
 * only — never the solver), announcements. No secrets, seeds, private challenge
 * data, correct answers, ownership maps, or anti-cheat internals.
 */
import { and, asc, gt, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { EventRow } from '../auth/types';
import { announcements, challenges, firstBloods } from '../db/schema';
import { getEventTiming } from '../event/timer';
import type { EventTiming } from '../event/types';

export interface UpdateCursors {
	/** Last first_bloods id the client has seen. */
	fb: number;
	/** Last announcements id the client has seen. */
	ann: number;
}

export interface FirstBloodUpdate {
	id: number;
	slot: number;
	/** Generic message — no participant identity. */
	message: string;
}
export interface AnnouncementUpdate {
	id: number;
	message: string;
}

export interface UpdateSnapshot {
	/** Opaque token capturing state + timing; changes ⇒ client should resync. */
	stateVersion: string;
	timing: EventTiming;
	firstBloods: FirstBloodUpdate[];
	announcements: AnnouncementUpdate[];
	cursors: UpdateCursors;
}

/** A version token that changes on state transitions AND timer extensions. */
export function stateVersion(event: EventRow, timing: EventTiming): string {
	return `${event.state}:${event.durationSeconds}:${timing.startedAt ?? 'null'}`;
}

/** Read authoritative D1 updates newer than the given cursors. */
export async function readUpdates(
	db: AnySQLiteDb,
	event: EventRow,
	cursors: UpdateCursors,
	now: Date = new Date(),
): Promise<UpdateSnapshot> {
	const timing = getEventTiming(event, now);

	const fbRows = await db
		.select({ id: firstBloods.id, slot: challenges.slot })
		.from(firstBloods)
		.innerJoin(challenges, eq(challenges.id, firstBloods.challengeId))
		.where(and(eq(firstBloods.eventId, event.id), gt(firstBloods.id, cursors.fb)))
		.orderBy(asc(firstBloods.id));

	const annRows = await db
		.select({ id: announcements.id, message: announcements.message })
		.from(announcements)
		.where(and(eq(announcements.eventId, event.id), gt(announcements.id, cursors.ann)))
		.orderBy(asc(announcements.id));

	const fbUpdates: FirstBloodUpdate[] = fbRows.map((r) => ({
		id: r.id,
		slot: r.slot,
		message: `First blood: Q${r.slot} has been cracked.`,
	}));

	const nextFb = fbUpdates.length ? fbUpdates[fbUpdates.length - 1].id : cursors.fb;
	const nextAnn = annRows.length ? annRows[annRows.length - 1].id : cursors.ann;

	return {
		stateVersion: stateVersion(event, timing),
		timing,
		firstBloods: fbUpdates,
		announcements: annRows,
		cursors: { fb: nextFb, ann: nextAnn },
	};
}

/** Format one SSE frame. */
export function sseFrame(event: string, data: unknown, id?: number): string {
	const idLine = id !== undefined ? `id: ${id}\n` : '';
	return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
