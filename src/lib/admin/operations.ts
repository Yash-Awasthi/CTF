/**
 * Phase 11 admin operations. Every mutation writes an `admin_actions` audit row
 * (plus its domain row) and uses centralized services — routes never mutate D1
 * directly. Timer extend / freeze / lifecycle reuse the Phase 3 event service.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { EventRow } from '../auth/types';
import {
	adminActions,
	announcements,
	antiCheatEvents,
	challengeBypasses,
	challenges,
	firstBloods,
	participants,
	sessions,
	solves,
	submissions,
} from '../db/schema';
import { getEventTiming } from '../event/timer';
import { getAdminLeaderboard } from '../leaderboard';
import { TOTAL_SLOTS } from '../challenges';
import { ADMIN_ACTIONS } from './constants';

const ACTOR = 'admin';

async function audit(
	db: AnySQLiteDb,
	eventId: number,
	actionType: string,
	payload?: Record<string, unknown>,
): Promise<void> {
	await db.insert(adminActions).values({
		eventId,
		actionType,
		actor: ACTOR,
		payload: payload ? JSON.stringify(payload) : null,
	});
}

/**
 * Reset a participant's stuck session: revoke active session(s). ALL progress —
 * score, solves, hints, anti-cheat records, status — is preserved (only the
 * session row is revoked). Audited.
 */
export async function resetParticipantSession(
	db: AnySQLiteDb,
	params: { eventId: number; participantId: number },
): Promise<{ revoked: number }> {
	const revoked = await db
		.update(sessions)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(sessions.eventId, params.eventId),
				eq(sessions.participantId, params.participantId),
				isNull(sessions.revokedAt),
			),
		)
		.returning({ id: sessions.id });
	await audit(db, params.eventId, ADMIN_ACTIONS.sessionReset, {
		participantId: params.participantId,
		revoked: revoked.length,
	});
	return { revoked: revoked.length };
}

export class BypassError extends Error {}

/**
 * Global challenge bypass (build-plan semantics: per event+challenge, NOT a fake
 * solve). Records a `challenge_bypasses` row and advances every participant
 * currently stuck AT that slot to slot+1 — no solve, no score, no first blood.
 * Distinct from a legitimate solve (no `solves` row is created). Audited.
 */
export async function bypassChallenge(
	db: AnySQLiteDb,
	params: { eventId: number; slot: number; reason?: string },
): Promise<{ challengeId: number; advanced: number }> {
	if (!Number.isInteger(params.slot) || params.slot < 1 || params.slot > TOTAL_SLOTS) {
		throw new BypassError(`invalid slot ${params.slot}`);
	}
	const challenge = await db
		.select({ id: challenges.id })
		.from(challenges)
		.where(and(eq(challenges.eventId, params.eventId), eq(challenges.slot, params.slot)))
		.get();
	if (!challenge) throw new BypassError(`no challenge for slot ${params.slot}`);

	await db.insert(challengeBypasses).values({
		eventId: params.eventId,
		challengeId: challenge.id,
		reason: params.reason ?? null,
		actor: ACTOR,
	});

	// Advance participants stuck at this slot (no score / no first blood).
	let advanced = 0;
	if (params.slot < TOTAL_SLOTS) {
		const rows = await db
			.update(participants)
			.set({ currentChallenge: params.slot + 1 })
			.where(
				and(
					eq(participants.eventId, params.eventId),
					eq(participants.currentChallenge, params.slot),
				),
			)
			.returning({ id: participants.id });
		advanced = rows.length;
	}

	await audit(db, params.eventId, ADMIN_ACTIONS.challengeBypass, {
		slot: params.slot,
		challengeId: challenge.id,
		advanced,
		reason: params.reason ?? null,
	});
	return { challengeId: challenge.id, advanced };
}

/** Create an event-scoped announcement (persisted first; SSE is notification). */
export async function createAnnouncement(
	db: AnySQLiteDb,
	params: { eventId: number; message: string },
): Promise<{ id: number }> {
	const inserted = await db
		.insert(announcements)
		.values({ eventId: params.eventId, message: params.message })
		.returning({ id: announcements.id });
	await audit(db, params.eventId, ADMIN_ACTIONS.announcement, { announcementId: inserted[0].id });
	return { id: inserted[0].id };
}

/** Event-scoped announcements (newest first). Also used by participant fetch. */
export async function listAnnouncements(db: AnySQLiteDb, eventId: number) {
	return db
		.select({ id: announcements.id, message: announcements.message, createdAt: announcements.createdAt })
		.from(announcements)
		.where(eq(announcements.eventId, eventId))
		.orderBy(desc(announcements.createdAt));
}

/** A consolidated read-only operational snapshot for the dashboard. */
export async function getAdminOverview(db: AnySQLiteDb, event: EventRow, now: Date = new Date()) {
	const timing = getEventTiming(event, now);

	const statusRows = await db
		.select({ status: participants.status, count: sql<number>`COUNT(*)` })
		.from(participants)
		.where(eq(participants.eventId, event.id))
		.groupBy(participants.status);
	const participantsByStatus = Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)]));
	const participantCount = statusRows.reduce((a, r) => a + Number(r.count), 0);

	const solveCountRows = await db
		.select({ slot: challenges.slot, count: sql<number>`COUNT(${solves.id})` })
		.from(challenges)
		.leftJoin(solves, and(eq(solves.challengeId, challenges.id), eq(solves.eventId, event.id)))
		.where(eq(challenges.eventId, event.id))
		.groupBy(challenges.slot)
		.orderBy(challenges.slot);
	const solveCounts = solveCountRows.map((r) => ({ slot: r.slot, count: Number(r.count) }));

	const antiCheat = await db
		.select({
			id: antiCheatEvents.id,
			submitterParticipantId: antiCheatEvents.submitterParticipantId,
			matchedParticipantId: antiCheatEvents.matchedParticipantId,
			challengeId: antiCheatEvents.challengeId,
			createdAt: antiCheatEvents.createdAt,
		})
		.from(antiCheatEvents)
		.where(eq(antiCheatEvents.eventId, event.id))
		.orderBy(desc(antiCheatEvents.createdAt));

	const bloods = await db
		.select({ challengeId: firstBloods.challengeId, participantId: firstBloods.participantId, claimedAt: firstBloods.claimedAt })
		.from(firstBloods)
		.where(eq(firstBloods.eventId, event.id));

	const activeSessions = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(sessions)
		.where(and(eq(sessions.eventId, event.id), isNull(sessions.revokedAt)))
		.get();

	const recentSubmissions = await db
		.select({
			id: submissions.id,
			participantId: submissions.participantId,
			challengeId: submissions.challengeId,
			isCorrect: submissions.isCorrect,
			createdAt: submissions.createdAt,
		})
		.from(submissions)
		.where(eq(submissions.eventId, event.id))
		.orderBy(desc(submissions.createdAt))
		.limit(25);

	const leaderboard = await getAdminLeaderboard(db, event.id);

	return {
		event: { slug: event.slug, name: event.name, state: event.state },
		timing,
		participantCount,
		participantsByStatus,
		activeSessions: Number(activeSessions?.count ?? 0),
		solveCounts,
		firstBloods: bloods,
		antiCheatEvents: antiCheat,
		recentSubmissions,
		leaderboard,
	};
}

/** Recent audit log for the event (admin visibility). */
export async function listAuditLog(db: AnySQLiteDb, eventId: number, limit = 50) {
	return db
		.select()
		.from(adminActions)
		.where(eq(adminActions.eventId, eventId))
		.orderBy(desc(adminActions.createdAt))
		.limit(limit);
}
