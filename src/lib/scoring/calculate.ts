/**
 * The single source of truth for the locked score formula. All math is INTEGER
 * to avoid any float drift in D1 (build plan §"Score precision"):
 *
 *   time_factor = max(0.5, 1 - (elapsed / duration) × 0.5)
 *   hint_factor = 0.5 if any hint used, else 1.0
 *   final_score(milli) = round(base_points × time_factor × hint_factor × 1000)
 *
 * The final score is computed with a SINGLE rounding over exact integer
 * fractions — never by multiplying pre-rounded per-mille factors — so the
 * persisted milli-point value is exact and reproducible.
 */
import type { EventRow } from '../auth/types';
import {
	HINT_FACTOR_NONE,
	HINT_FACTOR_USED,
	MILLI,
	PER_MILLE,
	TIME_FACTOR_FLOOR,
} from './constants';
import type { ScoreInputs, SolveScore } from './types';

/** Round a non-negative integer division n/d to the nearest integer, exactly. */
function roundDiv(n: number, d: number): number {
	return Math.floor((n + Math.floor(d / 2)) / d);
}

/**
 * Integer elapsed seconds between event start and a solve. Clamped to ≥ 0.
 * Uses ONLY authoritative server timestamps (never browser/client time).
 * @throws if the event has not started (no authoritative start).
 */
export function deriveElapsedSeconds(event: EventRow, solvedAt: Date): number {
	if (!event.startedAt) {
		throw new Error('deriveElapsedSeconds: event has not started');
	}
	const startedSec = Math.floor(event.startedAt.getTime() / 1000);
	const solvedSec = Math.floor(solvedAt.getTime() / 1000);
	return Math.max(0, solvedSec - startedSec);
}

/**
 * time_factor as a per-mille integer (500..1000). Elapsed is clamped to
 * [0, duration]; at/after duration the factor floors at 500 (0.5).
 */
export function timeFactorPerMille(
	elapsedSeconds: number,
	durationSeconds: number,
): number {
	if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
		throw new Error('timeFactorPerMille: durationSeconds must be a positive integer');
	}
	const e = Math.min(Math.max(0, Math.floor(elapsedSeconds)), durationSeconds);
	// (2D - e) / (2D) × 1000, exact integer division with rounding.
	const twoD = 2 * durationSeconds;
	const permille = roundDiv((twoD - e) * PER_MILLE, twoD);
	return Math.max(TIME_FACTOR_FLOOR, permille);
}

/**
 * Compute the full solve score. Returns integer per-mille factors + integer
 * milli-point final score (single end rounding over exact fractions).
 */
export function calculateSolveScore(inputs: ScoreInputs): SolveScore {
	const { basePoints, elapsedSeconds, durationSeconds, hintUsed } = inputs;
	if (!Number.isInteger(basePoints) || basePoints <= 0) {
		throw new Error('calculateSolveScore: basePoints must be a positive integer');
	}
	if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
		throw new Error('calculateSolveScore: durationSeconds must be a positive integer');
	}

	const hintFactor = hintUsed ? HINT_FACTOR_USED : HINT_FACTOR_NONE;
	const timeFactor = timeFactorPerMille(elapsedSeconds, durationSeconds);

	// Exact single-rounding: final = round(base × tf × hf × 1000) where
	//   tf = (2D - e) / (2D),  hf = hfNum/hfDen (1/1 or 1/2).
	const e = Math.min(Math.max(0, Math.floor(elapsedSeconds)), durationSeconds);
	const twoD = 2 * durationSeconds;
	const hfNum = hintUsed ? 1 : 1;
	const hfDen = hintUsed ? 2 : 1;
	const numerator = basePoints * MILLI * (twoD - e) * hfNum;
	const denominator = twoD * hfDen;
	const finalScore = roundDiv(numerator, denominator);

	return { timeFactor, hintFactor, finalScore };
}

/** Convenience: compute a solve score directly from an event row + solve time. */
export function calculateSolveScoreForEvent(
	basePoints: number,
	event: EventRow,
	solvedAt: Date,
	hintUsed: boolean,
): SolveScore {
	return calculateSolveScore({
		basePoints,
		elapsedSeconds: deriveElapsedSeconds(event, solvedAt),
		durationSeconds: event.durationSeconds,
		hintUsed,
	});
}
