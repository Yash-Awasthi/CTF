/**
 * Dynamic Scoring System
 *
 * Extracted from Jeopardy-Platform (inspiration).
 * Challenge scoring with dynamic point adjustment based on solve rate,
 * difficulty tiers, time bonuses, and team competition.
 */

export interface Challenge {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  base_points: number;
  current_points: number;
  solves: number;
  attempts: number;
  hints_used: number;
  created_at: string;
  flag: string;
}

export interface Solve {
  challenge_id: string;
  team_id: string;
  solved_at: string;
  points_earned: number;
  time_taken_seconds: number;
  hints_used: number;
}

export interface ScoringConfig {
  /** Decay rate for solve-based scoring */
  decay_rate: number;
  /** Minimum points as fraction of base */
  min_points_fraction: number;
  /** Time bonus factor (points per second faster than average) */
  time_bonus_per_second: number;
  /** Hint penalty per hint */
  hint_penalty: number;
  /** First blood bonus */
  first_blood_bonus: number;
  /** Speed bonus for fast solves */
  speed_bonus_threshold_seconds: number;
  speed_bonus_multiplier: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  decay_rate: 0.95,
  min_points_fraction: 0.25,
  time_bonus_per_second: 0.5,
  hint_penalty: 50,
  first_blood_bonus: 100,
  speed_bonus_threshold_seconds: 300,
  speed_bonus_multiplier: 1.5,
};

/**
 * Calculate dynamic points based on solve count
 */
export function calculateDynamicPoints(
  base_points: number,
  solves: number,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): number {
  const min_points = base_points * config.min_points_fraction;
  const dynamic = base_points * Math.pow(config.decay_rate, solves);
  return Math.max(Math.round(dynamic), Math.round(min_points));
}

/**
 * Calculate final score for a solve
 */
export function calculateSolveScore(
  challenge: Challenge,
  solve_time_seconds: number,
  is_first_blood: boolean,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): {
  base_score: number;
  time_bonus: number;
  hint_penalty: number;
  first_blood_bonus: number;
  speed_bonus: number;
  total_score: number;
} {
  // Base score from dynamic calculation
  const base_score = calculateDynamicPoints(
    challenge.base_points,
    challenge.solves,
    config,
  );

  // Time bonus (faster = more points)
  const avg_solve_time = 600; // 10 minutes default
  const time_diff = Math.max(0, avg_solve_time - solve_time_seconds);
  const time_bonus = Math.round(time_diff * config.time_bonus_per_second);

  // Hint penalty
  const hint_penalty = challenge.hints_used * config.hint_penalty;

  // First blood bonus
  const first_blood = is_first_blood ? config.first_blood_bonus : 0;

  // Speed bonus
  const speed_bonus = solve_time_seconds < config.speed_bonus_threshold_seconds
    ? Math.round(base_score * (config.speed_bonus_multiplier - 1))
    : 0;

  const total_score = Math.max(
    0,
    base_score + time_bonus - hint_penalty + first_blood + speed_bonus,
  );

  return {
    base_score,
    time_bonus,
    hint_penalty,
    first_blood_bonus: first_blood,
    speed_bonus,
    total_score,
  };
}

/**
 * Update challenge points after a solve
 */
export function updateChallengeAfterSolve(
  challenge: Challenge,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): Challenge {
  return {
    ...challenge,
    solves: challenge.solves + 1,
    current_points: calculateDynamicPoints(
      challenge.base_points,
      challenge.solves + 1,
      config,
    ),
  };
}

/**
 * Calculate team score from all solves
 */
export function calculateTeamScore(solves: Solve[]): {
  total_points: number;
  challenges_solved: number;
  average_solve_time: number;
  first_bloods: number;
} {
  if (!solves.length) {
    return { total_points: 0, challenges_solved: 0, average_solve_time: 0, first_bloods: 0 };
  }

  const total_points = solves.reduce((sum, s) => sum + s.points_earned, 0);
  const avg_time = solves.reduce((sum, s) => sum + s.time_taken_seconds, 0) / solves.length;

  return {
    total_points,
    challenges_solved: solves.length,
    average_solve_time: Math.round(avg_time),
    first_bloods: 0, // Would need cross-team data to calculate
  };
}

/**
 * Generate leaderboard from team scores
 */
export function generateLeaderboard(
  teams: Array<{ id: string; name: string; solves: Solve[] }>,
): Array<{
  rank: number;
  team_id: string;
  team_name: string;
  total_points: number;
  challenges_solved: number;
}> {
  const leaderboard = teams.map(team => ({
    rank: 0,
    team_id: team.id,
    team_name: team.name,
    ...calculateTeamScore(team.solves),
  }));

  leaderboard.sort((a, b) => b.total_points - a.total_points);
  leaderboard.forEach((entry, i) => { entry.rank = i + 1; });

  return leaderboard;
}

/**
 * Validate flag submission
 */
export function validateFlag(
  submitted: string,
  expected: string,
): { correct: boolean; normalized_submitted: string } {
  const normalize = (s: string) => s.trim().toLowerCase();
  return {
    correct: normalize(submitted) === normalize(expected),
    normalized_submitted: normalize(submitted),
  };
}

/**
 * Calculate category completion stats
 */
export function categoryStats(
  challenges: Challenge[],
): Array<{
  category: string;
  total: number;
  solved: number;
  completion_pct: number;
  total_points: number;
}> {
  const byCategory: Record<string, Challenge[]> = {};
  for (const c of challenges) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }

  return Object.entries(byCategory).map(([category, cats]) => ({
    category,
    total: cats.length,
    solved: cats.filter(c => c.solves > 0).length,
    completion_pct: Math.round((cats.filter(c => c.solves > 0).length / cats.length) * 100),
    total_points: cats.reduce((sum, c) => sum + c.current_points, 0),
  }));
}
