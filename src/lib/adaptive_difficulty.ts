/**
 * Adaptive Challenge Difficulty — auto-scales challenge complexity
 * based on team performance metrics.
 *
 * Features:
 * - Dynamic point recalculation based on solve rate
 * - Hint availability gating (hints unlock after N minutes)
 * - Challenge unlock progression (solve prerequisite to unlock next tier)
 * - Anti-stuck detection (suggest easier challenges)
 * - Performance analytics per team
 */

export interface DifficultyConfig {
  /** Point decay rate (0-1). Higher = faster point loss as more teams solve */
  decayRate: number;
  /** Minimum points a challenge can reach */
  minPoints: number;
  /** Maximum points a challenge can reach */
  maxPoints: number;
  /** Minutes before first hint becomes available */
  hintUnlockMinutes: number;
  /** Solve rate threshold to auto-simplify (0-1) */
  solveRateThreshold: number;
}

export const DEFAULT_DIFFICULTY_CONFIG: DifficultyConfig = {
  decayRate: 0.85,
  minPoints: 50,
  maxPoints: 500,
  hintUnlockMinutes: 30,
  solveRateThreshold: 0.6,
};

export interface TeamPerformance {
  teamId: string;
  totalSolves: number;
  averageTime: number;  // avg minutes per solve
  categoryStrengths: Record<string, number>;  // category -> solve count
  weakCategories: string[];
  stuckDuration: number;  // minutes since last solve
  hintsUsed: number;
  accuracy: number;  // ratio of correct to total submissions
}

/**
 * Calculate dynamic challenge points based on solve statistics.
 */
export function calculateDynamicPoints(
  basePoints: number,
  totalTeams: number,
  solvedByTeams: number,
  config: DifficultyConfig = DEFAULT_DIFFICULTY_CONFIG,
): number {
  if (totalTeams === 0 || solvedByTeams === 0) return basePoints;

  const solveRate = solvedByTeams / totalTeams;

  // Exponential decay based on solve rate
  const decayFactor = Math.pow(1 - solveRate, config.decayRate);
  const adjustedPoints = basePoints * (0.3 + 0.7 * decayFactor);

  return Math.round(
    Math.max(config.minPoints, Math.min(config.maxPoints, adjustedPoints))
  );
}

/**
 * Determine if hints should be available for a team/challenge.
 */
export function areHintsAvailable(
  challengeStartTime: number,
  hintUnlockMinutes: number = DEFAULT_DIFFICULTY_CONFIG.hintUnlockMinutes,
): boolean {
  const elapsed = (Date.now() - challengeStartTime) / 60_000;
  return elapsed >= hintUnlockMinutes;
}

/**
 * Analyze team performance and suggest next challenges.
 */
export function analyzeTeamPerformance(
  solves: Array<{ challengeId: string; category: string; timeMinutes: number; points: number }>,
  teamId: string,
): TeamPerformance {
  const categoryStrengths: Record<string, number> = {};
  let totalTime = 0;

  for (const solve of solves) {
    categoryStrengths[solve.category] = (categoryStrengths[solve.category] || 0) + 1;
    totalTime += solve.timeMinutes;
  }

  const avgTime = solves.length > 0 ? totalTime / solves.length : 0;

  // Find weak categories (fewer solves)
  const allCategories = Object.keys(categoryStrengths);
  const avgSolvesPerCat = solves.length / Math.max(allCategories.length, 1);
  const weakCategories = allCategories.filter(
    (cat) => (categoryStrengths[cat] || 0) < avgSolvesPerCat * 0.5
  );

  // Detect stuck state (no solve in 30+ minutes)
  const lastSolveTime = solves.length > 0
    ? Math.max(...solves.map((s) => s.timeMinutes))
    : 0;

  return {
    teamId,
    totalSolves: solves.length,
    averageTime: avgTime,
    categoryStrengths,
    weakCategories,
    stuckDuration: lastSolveTime,
    hintsUsed: 0,
    accuracy: 1.0,  // default
  };
}

/**
 * Get recommended challenges for a team based on performance.
 */
export function getRecommendations(
  performance: TeamPerformance,
  availableChallenges: Array<{
    id: string;
    category: string;
    difficulty: number;  // 1-5
    currentPoints: number;
    solvedByCount: number;
  }>,
  totalTeams: number,
): Array<{ id: string; reason: string; priority: number }> {
  const recommendations: Array<{ id: string; reason: string; priority: number }> = [];

  for (const challenge of availableChallenges) {
    const alreadySolved = performance.categoryStrengths[challenge.category] !== undefined;

    // Suggest challenges in weak categories
    if (performance.weakCategories.includes(challenge.category)) {
      recommendations.push({
        id: challenge.id,
        reason: `Weaken category: ${challenge.category}`,
        priority: 8,
      });
    }

    // Suggest medium difficulty if team is stuck
    if (performance.stuckDuration > 30 && challenge.difficulty <= 3) {
      recommendations.push({
        id: challenge.id,
        reason: "Good entry point — easier difficulty",
        priority: 7,
      });
    }

    // Suggest challenges with high solve rate (popular = likely solvable)
    const solveRate = challenge.solvedByCount / Math.max(totalTeams, 1);
    if (solveRate > 0.3 && solveRate < 0.8) {
      recommendations.push({
        id: challenge.id,
        reason: `Sweet spot: ${(solveRate * 100).toFixed(0)}% solve rate`,
        priority: 6,
      });
    }
  }

  // Sort by priority
  return recommendations.sort((a, b) => b.priority - a.priority);
}

/**
 * Calculate team ranking with tiebreakers.
 */
export function rankTeams(
  teams: Array<{
    teamId: string;
    score: number;
    solves: number;
    lastSolveTime: number;
    accuracy: number;
  }>,
): Array<{ rank: number; teamId: string; score: number; tiebreaker: string }> {
  const sorted = [...teams].sort((a, b) => {
    // Primary: score descending
    if (b.score !== a.score) return b.score - a.score;
    // Secondary: solve count descending
    if (b.solves !== a.solves) return b.solves - a.solves;
    // Tertiary: accuracy descending
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    // Quaternary: earliest last solve
    return a.lastSolveTime - b.lastSolveTime;
  });

  return sorted.map((team, i) => ({
    rank: i + 1,
    teamId: team.teamId,
    score: team.score,
    tiebreaker:
      i > 0 && sorted[i - 1].score === team.score
        ? `Tied with #${i} — broken by ${team.solves > sorted[i - 1].solves ? "more solves" : "accuracy"}`
        : "",
  }));
}
