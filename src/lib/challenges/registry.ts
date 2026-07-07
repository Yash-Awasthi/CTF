/**
 * The single, EXPLICIT challenge registry. No runtime filesystem scanning and no
 * dynamic import of user-controlled paths — modules are registered by value here
 * and validated at module load. Real modules replace the placeholder array later
 * without changing this file's shape.
 */
import { RegistryError } from './errors';
import { PLACEHOLDER_CHALLENGES } from './placeholders';
import type { ChallengeModule } from './types';

/** Expected slots: exactly 1..30. */
export const TOTAL_SLOTS = 30;

const MODULES: readonly ChallengeModule[] = PLACEHOLDER_CHALLENGES;

/**
 * Validate registry invariants. Throws RegistryError on the first violation.
 * Called once at load; also exported for explicit tests.
 */
export function validateChallengeRegistry(
	modules: readonly ChallengeModule[] = MODULES,
): void {
	if (modules.length !== TOTAL_SLOTS) {
		throw new RegistryError(
			`expected ${TOTAL_SLOTS} modules, got ${modules.length}`,
		);
	}

	const slots = new Set<number>();
	const keys = new Set<string>();

	for (const m of modules) {
		const { slot, key, title, basePoints, tier, attributionEnabled } = m.metadata;

		if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_SLOTS) {
			throw new RegistryError(`invalid slot: ${slot}`);
		}
		if (slots.has(slot)) throw new RegistryError(`duplicate slot: ${slot}`);
		slots.add(slot);

		if (typeof key !== 'string' || key.length === 0) {
			throw new RegistryError(`slot ${slot}: empty key`);
		}
		if (keys.has(key)) throw new RegistryError(`duplicate key: ${key}`);
		keys.add(key);

		if (typeof title !== 'string' || title.length === 0) {
			throw new RegistryError(`slot ${slot}: empty title`);
		}
		if (!Number.isInteger(basePoints) || basePoints <= 0) {
			throw new RegistryError(`slot ${slot}: basePoints must be a positive integer`);
		}
		if (!Array.isArray(m.hints) || m.hints.length !== 2) {
			throw new RegistryError(`slot ${slot}: must expose exactly two hints`);
		}
		if (m.hints[0].order !== 1 || m.hints[1].order !== 2) {
			throw new RegistryError(`slot ${slot}: hints must be ordered 1 then 2`);
		}
		if (attributionEnabled && typeof m.getAttributionPool !== 'function') {
			throw new RegistryError(
				`slot ${slot}: attributionEnabled requires getAttributionPool()`,
			);
		}
		void tier;
	}

	// Completeness: every slot 1..30 present.
	for (let s = 1; s <= TOTAL_SLOTS; s++) {
		if (!slots.has(s)) throw new RegistryError(`missing slot: ${s}`);
	}
}

// Fail fast at import time — a broken registry must never serve requests.
validateChallengeRegistry();

const BY_SLOT = new Map<number, ChallengeModule>(
	MODULES.map((m) => [m.metadata.slot, m]),
);
const BY_KEY = new Map<string, ChallengeModule>(
	MODULES.map((m) => [m.metadata.key, m]),
);

/** All registered modules in slot order. Returns a copy. */
export function getAllChallenges(): ChallengeModule[] {
	return [...MODULES].sort((a, b) => a.metadata.slot - b.metadata.slot);
}

/** Module for a slot, or undefined if unregistered. */
export function getChallengeBySlot(slot: number): ChallengeModule | undefined {
	return BY_SLOT.get(slot);
}

/** Module for a key, or undefined if unknown. */
export function getChallengeByKey(key: string): ChallengeModule | undefined {
	return BY_KEY.get(key);
}
