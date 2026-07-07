/**
 * Attribution-enabled personalization: assign exactly ONE unique answer to each
 * participant so a copied answer identifies its source (Phase 8 anti-cheat).
 *
 * This is a deterministic BIJECTION, not a retry-until-unique loop:
 *   1. participants in canonical order (roll ascending),
 *   2. answers normalized + validated unique (via the shared normalizeAnswer),
 *   3. a per-challenge attribution seed drives a deterministic shuffle of the
 *      answer pool,
 *   4. zip shuffled answers onto ordered participants.
 *
 * Uniqueness is judged AFTER normalization — the exact rule submission
 * validation uses — so "TOM"/"tom"/" Tom " are ONE answer, never three.
 *
 * Ordinary (non-attribution) personalization does NOT use this: it just reads a
 * participant/challenge RNG and may collide across participants. Only wire a
 * challenge through here when copied answers must be traceable.
 */
import { normalizeAnswer } from '../validation/answer';
import { deriveAttributionSeed } from './derive';
import { createDeterministicRng } from './rng';

/** Thrown when an attribution pool cannot form a valid bijection. */
export class AttributionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AttributionError';
	}
}

export interface AttributionAssignment {
	rollNumber: number;
	/** The exact answer string a participant must produce/submit. */
	answer: string;
	/** Its normalized form — the map key for ownership lookups. */
	normalizedAnswer: string;
}

/** Canonical participant ordering: roll number ascending. Returns a new array. */
export function canonicalParticipantOrder(rollNumbers: readonly number[]): number[] {
	return rollNumbers.slice().sort((a, b) => a - b);
}

/**
 * Validate an attribution pool BEFORE the event runs. Throws AttributionError
 * (never silently discards/regenerates) on any of:
 *  - empty/whitespace-only answer,
 *  - duplicate normalized answer,
 *  - pool smaller than the participant count.
 * Returns the normalized answers aligned to the input order.
 */
export function validateAttributionPool(
	rollNumbers: readonly number[],
	answers: readonly string[],
): string[] {
	if (rollNumbers.length === 0) {
		throw new AttributionError('validateAttributionPool: no participants');
	}
	if (answers.length < rollNumbers.length) {
		throw new AttributionError(
			`validateAttributionPool: pool has ${answers.length} answers for ${rollNumbers.length} participants`,
		);
	}
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const raw of answers) {
		const norm = normalizeAnswer(raw);
		if (norm.length === 0) {
			throw new AttributionError(
				'validateAttributionPool: empty normalized answer',
			);
		}
		if (seen.has(norm)) {
			throw new AttributionError(
				`validateAttributionPool: duplicate normalized answer ${JSON.stringify(norm)}`,
			);
		}
		seen.add(norm);
		normalized.push(norm);
	}
	// Roll numbers must themselves be unique for a clean bijection.
	if (new Set(rollNumbers).size !== rollNumbers.length) {
		throw new AttributionError('validateAttributionPool: duplicate roll numbers');
	}
	return normalized;
}

/**
 * Deterministically assign one unique answer to each participant for a given
 * challenge. Validates first (throws on invalid pool), then shuffles the pool
 * under the per-challenge attribution seed and zips onto roll-ascending order.
 *
 * The same (eventKey, slot, participants, answers) ALWAYS yields the same map;
 * a different slot yields a different map (attribution seed differs).
 */
export async function assignAttributionAnswers(
	eventKey: Uint8Array,
	challengeSlot: number,
	rollNumbers: readonly number[],
	answers: readonly string[],
): Promise<AttributionAssignment[]> {
	validateAttributionPool(rollNumbers, answers);

	const orderedRolls = canonicalParticipantOrder(rollNumbers);
	const seed = await deriveAttributionSeed(eventKey, challengeSlot);
	const rng = await createDeterministicRng(seed);

	// Shuffle indices into the answer pool, then take the first N. Using indices
	// keeps the original answer strings intact for normalization.
	const indices = await rng.shuffle(answers.map((_, i) => i));

	const assignments: AttributionAssignment[] = [];
	for (let i = 0; i < orderedRolls.length; i++) {
		const answer = answers[indices[i]];
		assignments.push({
			rollNumber: orderedRolls[i],
			answer,
			normalizedAnswer: normalizeAnswer(answer),
		});
	}
	return assignments;
}

/**
 * Ownership map for Phase 8: normalized answer → owning roll number. Throws if
 * two assignments collide on a normalized answer (should be impossible after a
 * validated bijection — this is a defensive invariant check).
 */
export function buildOwnershipMap(
	assignments: readonly AttributionAssignment[],
): Map<string, number> {
	const map = new Map<string, number>();
	for (const a of assignments) {
		if (map.has(a.normalizedAnswer)) {
			throw new AttributionError(
				`buildOwnershipMap: collision on ${JSON.stringify(a.normalizedAnswer)}`,
			);
		}
		map.set(a.normalizedAnswer, a.rollNumber);
	}
	return map;
}
