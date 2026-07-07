/**
 * Typed challenge-engine errors. Messages are safe for logs but callers must
 * map participant-facing responses to GENERIC text — never leak crypto internals,
 * private generation state, or correct answers to clients.
 */

export class ChallengeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

/** Slot is not an integer 1..30. */
export class InvalidSlotError extends ChallengeError {}
/** No registered module for the requested slot. */
export class ChallengeNotFoundError extends ChallengeError {}
/** Participant's progression does not permit access to this slot. */
export class ChallengeLockedError extends ChallengeError {}
/** Registry failed self-validation (dup/missing slot or key, bad metadata). */
export class RegistryError extends ChallengeError {}
/** generate() threw or produced an invalid instance. */
export class GenerationError extends ChallengeError {}
/** Attribution pool invalid, or participant absent from the assignment. */
export class AttributionConfigError extends ChallengeError {}
/** Registered modules and DB challenge rows disagree. */
export class RegistryDbMismatchError extends ChallengeError {}
