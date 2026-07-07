/**
 * Sequential progression access — the SINGLE source of truth. Pages and APIs
 * call these instead of scattering `slot <= current_challenge` comparisons.
 *
 * Progression semantics (chosen for Phase 5; Phase 6 solve logic depends on it):
 *   participants.current_challenge = the currently UNLOCKED slot (starts at 1).
 *   - slot <  current_challenge  → 'solved'  (revisitable read-only later)
 *   - slot === current_challenge → 'current' (the one being played)
 *   - slot >  current_challenge  → 'locked'  (no access by URL or API)
 *   After solving slot N (later phase): current_challenge becomes min(N+1, 30).
 *   Reaching slot 30 as current + solving it = completion, derived from solve
 *   data; current_challenge saturates at 30 (never 31).
 */
import { TOTAL_SLOTS } from './registry';
import { InvalidSlotError, ChallengeLockedError } from './errors';
import type { ChallengeAccessStatus } from './types';
import type { ParticipantRow } from '../auth/types';

/** True iff `slot` is an integer within 1..30. */
export function isValidSlot(slot: number): boolean {
	return Number.isInteger(slot) && slot >= 1 && slot <= TOTAL_SLOTS;
}

/** Parse a raw route param to a valid slot, or throw InvalidSlotError. */
export function parseSlot(raw: string | undefined): number {
	const slot = Number(raw);
	if (!raw || !isValidSlot(slot)) {
		throw new InvalidSlotError(`invalid slot: ${String(raw)}`);
	}
	return slot;
}

/** Classify a (participant, slot) pair. Throws InvalidSlotError on a bad slot. */
export function getChallengeAccessStatus(
	participant: Pick<ParticipantRow, 'currentChallenge'>,
	slot: number,
): ChallengeAccessStatus {
	if (!isValidSlot(slot)) throw new InvalidSlotError(`invalid slot: ${slot}`);
	const current = participant.currentChallenge;
	if (slot < current) return 'solved';
	if (slot === current) return 'current';
	return 'locked';
}

/** May the participant open this slot (current or previously-solved)? */
export function canAccessChallenge(
	participant: Pick<ParticipantRow, 'currentChallenge'>,
	slot: number,
): boolean {
	return getChallengeAccessStatus(participant, slot) !== 'locked';
}

/** Assert access; throws ChallengeLockedError for a locked future slot. */
export function assertChallengeAccess(
	participant: Pick<ParticipantRow, 'currentChallenge'>,
	slot: number,
): ChallengeAccessStatus {
	const status = getChallengeAccessStatus(participant, slot);
	if (status === 'locked') {
		throw new ChallengeLockedError(`slot ${slot} is locked`);
	}
	return status;
}
