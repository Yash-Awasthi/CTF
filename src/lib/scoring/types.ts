/** Scoring types. All persisted numbers are integers (per-mille / milli-points). */

/** Canonical, server-authoritative inputs to the score formula. */
export interface ScoreInputs {
	/** Challenge base points (whole points, e.g. 100). */
	basePoints: number;
	/** Integer seconds since event start at solve time (server-derived). */
	elapsedSeconds: number;
	/** Event total duration in seconds (> 0). */
	durationSeconds: number;
	/** Whether ANY hint was used on this challenge by this participant. */
	hintUsed: boolean;
}

/** Result of the score computation — all integers, safe to persist as-is. */
export interface SolveScore {
	/** time_factor as per-mille integer (500..1000). */
	timeFactor: number;
	/** hint_factor as per-mille integer (500 or 1000). */
	hintFactor: number;
	/** Final score in integer milli-points (single rounding applied). */
	finalScore: number;
}
