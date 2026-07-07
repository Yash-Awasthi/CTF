import { and, eq, isNull } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import { events, participants, sessions } from '../db/schema';
import { SESSION_TTL_SECONDS } from './constants';
import { generateSessionToken, hashSessionToken } from './session-token';
import type { AuthContext, EventRow, ParticipantRow } from './types';

/**
 * Create a session for a participant, enforcing one active session: any
 * existing non-revoked sessions are revoked first, then a fresh token is
 * inserted. The DB partial-unique index (`sessions_one_active_per_participant`)
 * backstops this so concurrent logins cannot leave two live sessions.
 * Returns the RAW token (only hash is persisted).
 */
export async function createSession(
	db: AnySQLiteDb,
	args: { event: EventRow; participant: ParticipantRow; now?: Date },
): Promise<{ rawToken: string; expiresAt: Date }> {
	const now = args.now ?? new Date();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
	const rawToken = generateSessionToken();
	const tokenHash = await hashSessionToken(rawToken);

	await db
		.update(sessions)
		.set({ revokedAt: now })
		.where(
			and(
				eq(sessions.participantId, args.participant.id),
				isNull(sessions.revokedAt),
			),
		);

	await db.insert(sessions).values({
		eventId: args.event.id,
		participantId: args.participant.id,
		tokenHash,
		expiresAt,
	});

	return { rawToken, expiresAt };
}

/** Revoke the session identified by a raw token (idempotent). */
export async function revokeSessionByRawToken(
	db: AnySQLiteDb,
	rawToken: string,
	now: Date = new Date(),
): Promise<void> {
	const tokenHash = await hashSessionToken(rawToken);
	await db
		.update(sessions)
		.set({ revokedAt: now })
		.where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
}

/**
 * Resolve a raw token → full auth context, or null if the token is missing,
 * unknown, revoked, or expired. Server-side lookup by token HASH.
 */
export async function findValidSession(
	db: AnySQLiteDb,
	rawToken: string | undefined,
	now: Date = new Date(),
): Promise<AuthContext | null> {
	if (!rawToken) return null;
	const tokenHash = await hashSessionToken(rawToken);

	const session = await db
		.select()
		.from(sessions)
		.where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)))
		.get();
	if (!session) return null;
	if (session.expiresAt.getTime() <= now.getTime()) return null;

	const participant = await db
		.select()
		.from(participants)
		.where(eq(participants.id, session.participantId))
		.get();
	if (!participant) return null;

	const event = await db
		.select()
		.from(events)
		.where(eq(events.id, session.eventId))
		.get();
	if (!event) return null;

	return { session, participant, event };
}
