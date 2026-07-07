/**
 * Small reusable validator helpers. Inputs are ALREADY normalized (the engine
 * applies the shared normalizeAnswer before calling a module's validate()).
 * These just express common comparison shapes — not a validation framework.
 */
import { normalizeAnswer } from '../validation/answer';
import type { ChallengeValidationResult } from './types';

/** Normalized exact match against a single expected answer. */
export function exactMatch(
	normalizedAnswer: string,
	expected: string,
): ChallengeValidationResult {
	return { correct: normalizedAnswer === normalizeAnswer(expected) };
}

/** Normalized match against any of several accepted answers. */
export function oneOf(
	normalizedAnswer: string,
	accepted: readonly string[],
): ChallengeValidationResult {
	const set = new Set(accepted.map(normalizeAnswer));
	return { correct: set.has(normalizedAnswer) };
}
