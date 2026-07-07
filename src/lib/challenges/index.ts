/**
 * Public API of the challenge engine. Routes/services import from here.
 * Server-only — nothing in this module tree may run in or ship to the browser.
 */
export type {
	ChallengeModule,
	ChallengeMetadata,
	ChallengeHint,
	ChallengeGenerationContext,
	GeneratedChallenge,
	ChallengeValidationResult,
	ChallengeAccessStatus,
	ChallengeTier,
} from './types';

export {
	getAllChallenges,
	getChallengeBySlot,
	getChallengeByKey,
	validateChallengeRegistry,
	TOTAL_SLOTS,
} from './registry';

export {
	getChallengeAccessStatus,
	canAccessChallenge,
	assertChallengeAccess,
	isValidSlot,
	parseSlot,
} from './access';

export { getEventRoster } from './roster';

export {
	syncChallengeRows,
	validateChallengeConsistency,
	getChallengeRowId,
} from './sync';

export {
	generateChallengeForParticipant,
	getPublicChallengeData,
	validateChallengeAnswer,
	getChallengeHints,
	getAttributionOwnershipMap,
} from './engine';
export type { EngineContext, EngineEvent, PublicChallengeData } from './engine';

export {
	ChallengeError,
	InvalidSlotError,
	ChallengeNotFoundError,
	ChallengeLockedError,
	RegistryError,
	GenerationError,
	AttributionConfigError,
	RegistryDbMismatchError,
} from './errors';

export { exactMatch, oneOf } from './validators';
