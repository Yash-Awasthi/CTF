/**
 * The high-level challenge engine. Routes/services call THIS — never the
 * registry + crypto + attribution + normalization directly. The engine owns:
 *   registry resolution → seed derivation → attribution assignment →
 *   participant instance generation → public/private boundary → validation.
 *
 * Security boundary: modules receive only a seeded RNG + (optional) assigned
 * attribution answer. EVENT_SECRET, event keys, and seeds never leave here.
 */
import type { SecretEnv } from '../crypto/secrets';
import { resolveEventSecret } from '../crypto/secrets';
import {
	deriveChallengeSeed,
	deriveEventKey,
	deriveParticipantSeed,
} from '../crypto/derive';
import { createDeterministicRng } from '../crypto/rng';
import {
	assignAttributionAnswers,
	buildOwnershipMap,
} from '../crypto/attribution';
import { normalizeAnswer } from '../validation/answer';
import {
	AttributionConfigError,
	ChallengeNotFoundError,
	GenerationError,
} from './errors';
import { getChallengeBySlot } from './registry';
import type {
	ChallengeHint,
	ChallengeModule,
	ChallengeValidationResult,
	GeneratedChallenge,
} from './types';

/** Stable event identity the engine needs (subset of the events row). */
export interface EngineEvent {
	slug: string;
	secretVersion: string;
}

/** Everything the engine needs to personalize for one participant. */
export interface EngineContext {
	env: SecretEnv;
	event: EngineEvent;
	rollNumber: number;
	/** Full event roster (roll asc). Required for attribution-enabled slots. */
	roster?: number[];
}

/** Browser-safe projection: safe metadata + the module's publicData ONLY. */
export interface PublicChallengeData {
	slot: number;
	key: string;
	title: string;
	tier: string;
	basePoints: number;
	attributionEnabled: boolean;
	publicData: unknown;
}

interface Generated {
	module: ChallengeModule;
	instance: GeneratedChallenge;
}

function requireModule(slot: number): ChallengeModule {
	const m = getChallengeBySlot(slot);
	if (!m) throw new ChallengeNotFoundError(`no module for slot ${slot}`);
	return m;
}

/** Derive this participant's per-challenge seeds. Server-only. */
async function deriveSeeds(ctx: EngineContext, slot: number) {
	const secret = resolveEventSecret(ctx.env, ctx.event.secretVersion);
	const eventKey = await deriveEventKey(secret, {
		slug: ctx.event.slug,
		secretVersion: ctx.event.secretVersion,
	});
	const participantSeed = await deriveParticipantSeed(eventKey, ctx.rollNumber);
	const challengeSeed = await deriveChallengeSeed(participantSeed, slot);
	return { eventKey, challengeSeed };
}

/** Resolve this participant's assigned attribution answer for a slot. */
async function resolveAttributionAnswer(
	module: ChallengeModule,
	eventKey: Uint8Array,
	slot: number,
	ctx: EngineContext,
): Promise<string> {
	if (!ctx.roster || ctx.roster.length === 0) {
		throw new AttributionConfigError(`slot ${slot}: roster required for attribution`);
	}
	if (typeof module.getAttributionPool !== 'function') {
		throw new AttributionConfigError(`slot ${slot}: missing getAttributionPool()`);
	}
	const pool = module.getAttributionPool(ctx.roster.length);
	const assignments = await assignAttributionAnswers(
		eventKey,
		slot,
		ctx.roster,
		pool,
	);
	const mine = assignments.find((a) => a.rollNumber === ctx.rollNumber);
	if (!mine) {
		throw new AttributionConfigError(
			`slot ${slot}: participant ${ctx.rollNumber} absent from assignment`,
		);
	}
	return mine.answer;
}

/**
 * Generate the participant-specific instance (module + public/private data).
 * Deterministic for a fixed (event, secret version, participant, slot).
 */
export async function generateChallengeForParticipant(
	ctx: EngineContext,
	slot: number,
): Promise<Generated> {
	const module = requireModule(slot);
	const { eventKey, challengeSeed } = await deriveSeeds(ctx, slot);
	const rng = await createDeterministicRng(challengeSeed);

	let attributionAnswer: string | undefined;
	if (module.metadata.attributionEnabled) {
		attributionAnswer = await resolveAttributionAnswer(module, eventKey, slot, ctx);
	}

	try {
		const instance = await module.generate({
			eventSlug: ctx.event.slug,
			rollNumber: ctx.rollNumber,
			slot,
			rng,
			attributionAnswer,
			related: async (earlier) => {
				if (!Number.isInteger(earlier) || earlier < 1 || earlier >= slot) {
					throw new GenerationError(`slot ${slot}: related(${earlier}) must name an earlier slot`);
				}
				return (await generateChallengeForParticipant(ctx, earlier)).instance;
			},
		});
		return { module, instance };
	} catch (err) {
		if (err instanceof AttributionConfigError) throw err;
		throw new GenerationError(
			`slot ${slot}: generation failed: ${(err as Error).message}`,
		);
	}
}

/** Browser-safe data only. This is what routes/APIs serialize. */
export async function getPublicChallengeData(
	ctx: EngineContext,
	slot: number,
): Promise<PublicChallengeData> {
	const { module, instance } = await generateChallengeForParticipant(ctx, slot);
	const { key, title, tier, basePoints, attributionEnabled } = module.metadata;
	// Explicit construction — privateData is never referenced here.
	return {
		slot,
		key,
		title,
		tier,
		basePoints,
		attributionEnabled,
		publicData: instance.publicData,
	};
}

/** Server-side validation of a raw submitted answer. Does not persist. */
export async function validateChallengeAnswer(
	ctx: EngineContext,
	slot: number,
	rawAnswer: string,
): Promise<ChallengeValidationResult> {
	const { module, instance } = await generateChallengeForParticipant(ctx, slot);
	const normalized = normalizeAnswer(rawAnswer);
	return module.validate(instance, normalized);
}

/** The two hint definitions for a slot. Never included in public data. */
export function getChallengeHints(slot: number): readonly [ChallengeHint, ChallengeHint] {
	return requireModule(slot).hints;
}

/**
 * Ownership map for an attribution-enabled slot: normalizedAnswer → rollNumber.
 * For Phase 8 anti-cheat. Ordinary challenges have no ownership map.
 */
export async function getAttributionOwnershipMap(
	ctx: EngineContext,
	slot: number,
): Promise<Map<string, number>> {
	const module = requireModule(slot);
	if (!module.metadata.attributionEnabled) {
		throw new AttributionConfigError(`slot ${slot} is not attribution-enabled`);
	}
	if (!ctx.roster || ctx.roster.length === 0) {
		throw new AttributionConfigError(`slot ${slot}: roster required`);
	}
	const { eventKey } = await deriveSeeds(ctx, slot);
	const pool = module.getAttributionPool!(ctx.roster.length);
	const assignments = await assignAttributionAnswers(
		eventKey,
		slot,
		ctx.roster,
		pool,
	);
	return buildOwnershipMap(assignments);
}
