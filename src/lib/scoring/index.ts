/**
 * Public API of the scoring engine. The submission phase (later) uses
 * `recordSolve` as the single source of truth for score math + persistence.
 * Server-only.
 */
export {
	MILLI,
	PER_MILLE,
	TIME_FACTOR_FLOOR,
	TIME_FACTOR_FULL,
	HINT_FACTOR_NONE,
	HINT_FACTOR_USED,
} from './constants';
export type { ScoreInputs, SolveScore } from './types';
export {
	calculateSolveScore,
	calculateSolveScoreForEvent,
	timeFactorPerMille,
	deriveElapsedSeconds,
} from './calculate';
export {
	recordSolve,
	recomputeParticipantScore,
	verifyParticipantScore,
	getLeaderboard,
	getSolveHistory,
	getChallengeSolveCounts,
} from './aggregate';
export type { RecordSolveInput, RecordSolveResult, LeaderboardRow } from './aggregate';
