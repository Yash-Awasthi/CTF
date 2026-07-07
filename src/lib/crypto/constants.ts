/**
 * Cryptographic domain-separation labels and centralized alphabets.
 *
 * Every derivation stage uses an explicit, stable, versioned label so an HMAC
 * output can only ever mean one thing. Changing any label is a breaking change
 * to every downstream seed and MUST bump the label version and its test vectors.
 */

export const DOMAIN = {
	/** Root key: HMAC(secret, frame(EVENT_KEY, secretVersion, eventSlug)). */
	eventKey: 'case-files:event-key:v1',
	/** Participant seed: HMAC(eventKey, frame(PARTICIPANT_SEED, rollNumber)). */
	participantSeed: 'case-files:participant-seed:v1',
	/** Challenge seed: HMAC(participantSeed, frame(CHALLENGE_SEED, slot)). */
	challengeSeed: 'case-files:challenge-seed:v1',
	/** RNG expansion block: HMAC(seed, frame(RNG_BLOCK, counter)). */
	rngBlock: 'case-files:rng-block:v1',
	/** Attribution seed: HMAC(eventKey, frame(ATTRIBUTION, slot)). */
	attribution: 'case-files:attribution:v1',
} as const;

/** Centralized alphabets for deterministic string generation. */
export const ALPHABETS = {
	upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
	lower: 'abcdefghijklmnopqrstuvwxyz',
	digits: '0123456789',
	alphanumeric:
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
	hex: '0123456789abcdef',
} as const;

/** Every HMAC-SHA256 output (and thus every seed) is 32 bytes. */
export const SEED_BYTES = 32;
