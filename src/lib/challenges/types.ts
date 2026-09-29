/**
 * The strict challenge-module contract every one of the 30 challenges satisfies.
 *
 * Separation of concerns (Phase 5 core principle):
 *   - ChallengeModule            — static definition (metadata + hints + behavior)
 *   - ChallengeGenerationContext — per-participant crypto inputs handed IN by the
 *                                  engine (modules never touch EVENT_SECRET/HMAC)
 *   - GeneratedChallenge         — per-participant result, split public/private
 *   - validate()                 — server-side answer check, module-owned
 *
 * Modules pick their OWN publicData/privateData shapes (generics) while still
 * satisfying one shared engine contract — no giant universal optional-field blob.
 */
import type { DeterministicRng } from '../crypto/rng';
import type { CHALLENGE_TIERS } from '../db/schema';

export type ChallengeTier = (typeof CHALLENGE_TIERS)[number];

/** Stable, code-authoritative metadata for one logical challenge. */
export interface ChallengeMetadata {
	/** Cryptographic + relational identity. Integer 1..30 (30 = final). */
	readonly slot: number;
	/** Stable non-empty string key, unique across the registry. */
	readonly key: string;
	readonly title: string;
	/** Positive integer, whole points (NOT milli-points; scoring converts later). */
	readonly basePoints: number;
	readonly tier: ChallengeTier;
	readonly attributionEnabled: boolean;
}

/** A single hint. Every module exposes exactly two, ordered 1 then 2. */
export interface ChallengeHint {
	readonly order: 1 | 2;
	readonly text: string;
}

/**
 * Crypto inputs the engine derives and passes to generate(). Everything here is
 * already personalized to (event, participant, slot); the module just consumes
 * `rng` / `attributionAnswer` and never re-derives anything itself.
 */
export interface ChallengeGenerationContext {
	readonly eventSlug: string;
	readonly rollNumber: number;
	readonly slot: number;
	/** Deterministic RNG seeded from this participant's challenge seed. */
	readonly rng: DeterministicRng;
	/**
	 * The participant's uniquely-assigned attribution answer. Present iff the
	 * module's `attributionEnabled` is true (engine guarantees this).
	 */
	readonly attributionAnswer?: string;
	/**
	 * This participant's instance of an earlier slot, so evidence can echo what
	 * they found before. Only lower slots are allowed, which rules out cycles.
	 */
	readonly related: (slot: number) => Promise<GeneratedChallenge>;
}

/**
 * A generated participant instance. `publicData` is the ONLY part allowed to
 * reach the browser; `privateData` (correct answer / validation material) is
 * server-only. The engine's public path returns publicData exclusively.
 */
export interface GeneratedChallenge<Public = unknown, Private = unknown> {
	readonly publicData: Public;
	readonly privateData: Private;
}

/** Result of a server-side validation. Extensible later (server-only fields). */
export interface ChallengeValidationResult {
	readonly correct: boolean;
}

/**
 * One challenge module. `Public`/`Private` default to unknown so the registry
 * can hold heterogeneous modules; each concrete module narrows them.
 */
export interface ChallengeModule<Public = unknown, Private = unknown> {
	readonly metadata: ChallengeMetadata;
	readonly hints: readonly [ChallengeHint, ChallengeHint];

	/** Produce this participant's instance. May be async (crypto is async). */
	generate(
		ctx: ChallengeGenerationContext,
	): GeneratedChallenge<Public, Private> | Promise<GeneratedChallenge<Public, Private>>;

	/**
	 * Server-side validation. Receives the already-normalized answer (shared
	 * normalizeAnswer boundary) and the generated instance. Module owns the rule.
	 */
	validate(
		instance: GeneratedChallenge<Public, Private>,
		normalizedAnswer: string,
	): ChallengeValidationResult;

	/**
	 * For attribution-enabled modules ONLY: the answer pool (>= roster size,
	 * unique after normalization). The engine assigns one answer per participant.
	 */
	getAttributionPool?(rosterSize: number): string[];

	/**
	 * Evidence files served at /{event}/evidence/{slot}/{name} once the slot is
	 * unlocked. Returns null for an unknown name (the route answers 404).
	 */
	artifact?(
		instance: GeneratedChallenge<Public, Private>,
		name: string,
	): ChallengeArtifact | null | Promise<ChallengeArtifact | null>;
}

/** One downloadable evidence file produced by a module. */
export interface ChallengeArtifact {
	readonly body: string | Uint8Array<ArrayBuffer>;
	readonly contentType: string;
	/** Download filename; when absent the file is served inline. */
	readonly filename?: string;
	readonly headers?: Record<string, string>;
}

/** Progression classification for a (participant, slot) pair. */
export type ChallengeAccessStatus = 'locked' | 'current' | 'solved';
