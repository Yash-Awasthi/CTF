/**
 * Public API of the deterministic personalization engine. Challenge modules
 * consume THESE high-level helpers — never raw HMAC.
 *
 * Server-only: nothing here may run in, or be shipped to, the browser. Secrets,
 * event keys, participant/challenge/attribution seeds, and RNG state stay on the
 * server. The client receives only rendered challenge content.
 */
export { DOMAIN, ALPHABETS, SEED_BYTES } from './constants';
export { toHex, fromHex, utf8, fingerprint } from './encoding';
export { resolveEventSecret, SecretResolutionError, SECRET_VERSION_BINDINGS } from './secrets';
export {
	deriveEventKey,
	deriveParticipantSeed,
	deriveChallengeSeed,
	deriveAttributionSeed,
} from './derive';
export { createDeterministicRng, DeterministicRng } from './rng';
export {
	assignAttributionAnswers,
	validateAttributionPool,
	buildOwnershipMap,
	canonicalParticipantOrder,
	AttributionError,
} from './attribution';
export type { EventIdentity, SecretEnv, AttributionAssignment, Seed } from './types';
