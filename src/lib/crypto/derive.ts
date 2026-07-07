/**
 * The three-stage deterministic derivation hierarchy:
 *
 *   event root key   = HMAC(secret,          frame[ EVENT_KEY,       version, slug ])
 *   participant seed = HMAC(eventKey,        frame[ PARTICIPANT_SEED, rollNumber   ])
 *   challenge seed   = HMAC(participantSeed, frame[ CHALLENGE_SEED,   slot         ])
 *   attribution seed = HMAC(eventKey,        frame[ ATTRIBUTION,      slot         ])
 *
 * Each stage's KEY is the previous stage's output, so EVENT_SECRET is never fed
 * directly into RNG or challenge derivation. Every stage carries an explicit,
 * length-prefixed, domain-separated label. Inputs are stable event/participant/
 * challenge identity ONLY — no time, no DB row ids, no mutable event state.
 */
import { DOMAIN } from './constants';
import { frame, utf8, u64 } from './encoding';
import { hmac } from './hmac';

/** Stable, immutable identity of an event. Slug is unique and never mutated. */
export interface EventIdentity {
	slug: string;
	secretVersion: string;
}

/**
 * Derive the event root key from raw secret bytes + stable event identity.
 * Two different events sharing a secret version get different keys (slug differs).
 */
export async function deriveEventKey(
	secret: Uint8Array,
	event: EventIdentity,
): Promise<Uint8Array> {
	if (!event.slug) throw new Error('deriveEventKey: event slug is required');
	if (!event.secretVersion) {
		throw new Error('deriveEventKey: secretVersion is required');
	}
	return hmac(
		secret,
		frame([utf8(DOMAIN.eventKey), utf8(event.secretVersion), utf8(event.slug)]),
	);
}

/** Derive a participant seed keyed by the event key + roll number. */
export async function deriveParticipantSeed(
	eventKey: Uint8Array,
	rollNumber: number,
): Promise<Uint8Array> {
	if (!Number.isInteger(rollNumber) || rollNumber < 0) {
		throw new Error(
			`deriveParticipantSeed: rollNumber must be a non-negative integer, got ${rollNumber}`,
		);
	}
	return hmac(
		eventKey,
		frame([utf8(DOMAIN.participantSeed), u64(rollNumber)]),
	);
}

/**
 * Derive a challenge seed keyed by the participant seed + challenge SLOT.
 * Slot (1..30) — never a DB autoincrement id — is the stable challenge identity,
 * so seeds survive clean migration + reseed across environments.
 */
export async function deriveChallengeSeed(
	participantSeed: Uint8Array,
	challengeSlot: number,
): Promise<Uint8Array> {
	if (!Number.isInteger(challengeSlot) || challengeSlot < 1) {
		throw new Error(
			`deriveChallengeSeed: challengeSlot must be a positive integer, got ${challengeSlot}`,
		);
	}
	return hmac(
		participantSeed,
		frame([utf8(DOMAIN.challengeSeed), u64(challengeSlot)]),
	);
}

/**
 * Derive the per-challenge attribution seed keyed by the EVENT key + slot.
 * Attribution permutes ALL participants for one challenge, so it is independent
 * of any single participant seed.
 */
export async function deriveAttributionSeed(
	eventKey: Uint8Array,
	challengeSlot: number,
): Promise<Uint8Array> {
	if (!Number.isInteger(challengeSlot) || challengeSlot < 1) {
		throw new Error(
			`deriveAttributionSeed: challengeSlot must be a positive integer, got ${challengeSlot}`,
		);
	}
	return hmac(
		eventKey,
		frame([utf8(DOMAIN.attribution), u64(challengeSlot)]),
	);
}
