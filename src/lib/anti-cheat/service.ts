/**
 * Phase 8 anti-cheat: deterministic foreign-answer attribution on the incorrect
 * submission path. NO heuristics — only an exact ownership-map hit counts.
 *
 * For an attribution-enabled challenge, the wrong normalized answer is looked up
 * in the Phase 4/5 deterministic ownership map (normalizedAnswer → rollNumber),
 * an O(1) hit — never an N-participant regeneration scan. If a FOREIGN
 * participant owns it, an `anti_cheat_events` row is recorded.
 *
 * Strike policy (per the Phase 8–12 sweep instructions; see the deviation note in
 * README/PROGRESS — the base build plan said "no auto-punishment"):
 *  - 1st confirmed foreign attribution → recorded, first strike, NOT eliminated.
 *  - 2nd (on a DIFFERENT challenge) → participant.status → 'disqualified'.
 * Strike idempotency: `UNIQUE(event, submitter, challenge)` — repeating the same
 * (or any) foreign answer on the same challenge never adds a second strike.
 *
 * This whole result is SERVER-ONLY. The participant always sees a generic
 * "incorrect"; the source participant is never revealed to the submitter.
 */
import { and, eq } from 'drizzle-orm';
import type { AnySQLiteDb } from '../db/client';
import type { SecretEnv } from '../crypto/secrets';
import type { EventRow, ParticipantRow } from '../auth/types';
import { antiCheatEvents, participants } from '../db/schema';
import { normalizeAnswer } from '../validation/answer';
import { getAttributionOwnershipMap } from '../challenges/engine';
import { getChallengeBySlot } from '../challenges/registry';

/** Two confirmed strikes → eliminated. */
export const STRIKE_LIMIT = 2;
/** Participant status used for elimination (already in PARTICIPANT_STATUSES). */
export const ELIMINATED_STATUS = 'disqualified' as const;

export interface AntiCheatResult {
	/** True iff a foreign-owned answer was detected this submission. */
	flagged: boolean;
	/** Source participant id (owner). Server-only — never sent to the client. */
	matchedParticipantId?: number;
	/** Total distinct strikes for this participant in this event. */
	strikeCount: number;
	/** True iff the participant is now eliminated. */
	eliminated: boolean;
}

/** Count distinct strikes (anti_cheat_events rows) for a participant. */
export async function getStrikeCount(
	db: AnySQLiteDb,
	eventId: number,
	participantId: number,
): Promise<number> {
	const rows = await db
		.select({ id: antiCheatEvents.id })
		.from(antiCheatEvents)
		.where(
			and(
				eq(antiCheatEvents.eventId, eventId),
				eq(antiCheatEvents.submitterParticipantId, participantId),
			),
		);
	return rows.length;
}

export interface ClassifyInput {
	env: SecretEnv;
	event: EventRow;
	participant: ParticipantRow;
	slot: number;
	challengeId: number;
	rawAnswer: string;
	roster: number[];
}

/**
 * Classify an already-determined INCORRECT submission. Records a strike and may
 * eliminate. Returns server-only classification (caller must NOT expose it).
 */
export async function classifyIncorrectSubmission(
	db: AnySQLiteDb,
	input: ClassifyInput,
): Promise<AntiCheatResult> {
	const { env, event, participant, slot, challengeId, rawAnswer, roster } = input;

	const module = getChallengeBySlot(slot);
	const priorStrikes = await getStrikeCount(db, event.id, participant.id);

	// Ordinary challenges: no ownership lookup at all.
	if (!module || !module.metadata.attributionEnabled) {
		return {
			flagged: false,
			strikeCount: priorStrikes,
			eliminated: participant.status === ELIMINATED_STATUS,
		};
	}

	const normalized = normalizeAnswer(rawAnswer);
	const ownership = await getAttributionOwnershipMap(
		{ env, event, rollNumber: participant.rollNumber, roster },
		slot,
	);
	const ownerRoll = ownership.get(normalized);

	// No owner, or the participant's OWN answer → not a foreign match.
	if (ownerRoll === undefined || ownerRoll === participant.rollNumber) {
		return {
			flagged: false,
			strikeCount: priorStrikes,
			eliminated: participant.status === ELIMINATED_STATUS,
		};
	}

	// Resolve the source participant's id (event-scoped).
	const owner = await db
		.select({ id: participants.id })
		.from(participants)
		.where(and(eq(participants.eventId, event.id), eq(participants.rollNumber, ownerRoll)))
		.get();

	// Record the strike (idempotent per event+submitter+challenge).
	await db
		.insert(antiCheatEvents)
		.values({
			eventId: event.id,
			submitterParticipantId: participant.id,
			challengeId,
			matchedParticipantId: owner?.id ?? participant.id,
			submittedAnswer: rawAnswer,
		})
		.onConflictDoNothing({
			target: [
				antiCheatEvents.eventId,
				antiCheatEvents.submitterParticipantId,
				antiCheatEvents.challengeId,
			],
		});

	const strikeCount = await getStrikeCount(db, event.id, participant.id);

	// Second strike → eliminate (conditional; idempotent).
	let eliminated = participant.status === ELIMINATED_STATUS;
	if (strikeCount >= STRIKE_LIMIT && !eliminated) {
		await db
			.update(participants)
			.set({ status: ELIMINATED_STATUS })
			.where(eq(participants.id, participant.id));
		eliminated = true;
	}

	return { flagged: true, matchedParticipantId: owner?.id, strikeCount, eliminated };
}
