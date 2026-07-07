/**
 * Locked scoring constants (build plan §"Scoring model" + "Score precision").
 * Formula: score = base_points × time_factor × hint_factor, persisted as
 * integer MILLI-POINTS (1 point = 1000 units). Do not change these.
 */

/** 1 point = 1000 milli-points. */
export const MILLI = 1000;

/** Factors are represented internally as per-mille integers (×1000). */
export const PER_MILLE = 1000;

/** time_factor floor: never below 0.5 (500 per-mille). */
export const TIME_FACTOR_FLOOR = 500;

/** time_factor ceiling at elapsed = 0: 1.0 (1000 per-mille). */
export const TIME_FACTOR_FULL = 1000;

/** hint_factor: 1.0 if no hint used on the challenge, else 0.5. Binary, once. */
export const HINT_FACTOR_NONE = 1000;
export const HINT_FACTOR_USED = 500;
