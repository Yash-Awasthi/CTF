/**
 * Scoring System
 * Extracted from CTFd's dynamic scoring patterns
 * Features: time decay, hint penalties, solve-count scaling, tie resolution
 */

export interface ScoringConfig {
  basePoints: number;
  timeDecayRate: number;        // Points lost per hour
  hintPenalty: number;          // Points lost per hint used
  minimumScore: number;         // Floor score
  solveCountScaling: boolean;   // Scale points based on solve count
  maxSolvesForScaling: number;  // Solve count where scaling stops
}

export interface SolveRecord {
  challengeId: string;
  userId: string;
  timestamp: number;
  hintsUsed: number;
  attempts: number;
}

export interface ScoringResult {
  score: number;
  breakdown: {
    base: number;
    timeBonus: number;
    hintPenalty: number;
    solveCountBonus: number;
  };
  rank: number;
  tiebreaker: string;
}

const DEFAULT_CONFIG: ScoringConfig = {
  basePoints: 500,
  timeDecayRate: 10,           // 10 points per hour
  hintPenalty: 50,             // 50 points per hint
  minimumScore: 100,
  solveCountScaling: true,
  maxSolvesForScaling: 100
};

/**
 * Calculate score for a solve attempt
 * Inspired by CTFd's scoring algorithm
 */
export function calculateScore(
  solve: SolveRecord,
  challengeStartTime: number,
  config: ScoringConfig = DEFAULT_CONFIG
): ScoringResult {
  const solveTime = (solve.timestamp - challengeStartTime) / 1000 / 3600; // Hours
  
  // Base score
  let score = config.basePoints;
  
  // Time bonus (higher score for faster solve)
  const timeBonus = Math.max(0, config.basePoints * 0.3 * Math.exp(-solveTime * config.timeDecayRate / config.basePoints));
  score += timeBonus;
  
  // Hint penalty
  const hintPenalty = solve.hintsUsed * config.hintPenalty;
  score -= hintPenalty;
  
  // Minimum score floor
  score = Math.max(config.minimumScore, score);
  
  return {
    score: Math.round(score),
    breakdown: {
      base: config.basePoints,
      timeBonus: Math.round(timeBonus),
      hintPenalty: hintPenalty,
      solveCountBonus: 0
    },
    rank: 0,
    tiebreaker: generateTiebreaker(solve)
  };
}

/**
 * Generate tiebreaker string for equal scores
 * Inspired by CTFd's tie resolution
 */
export function generateTiebreaker(solve: SolveRecord): string {
  // Use solve timestamp and attempt count for tiebreaker
  // Earlier solve time wins, then fewer attempts
  return `${solve.timestamp.toString().padStart(15, '0')}-${solve.attempts.toString().padStart(5, '0')}`;
}

/**
 * Apply solve-count scaling
 * More solves = lower point value (inspired by CTFd)
 */
export function applySolveCountScaling(
  score: number,
  solveCount: number,
  config: ScoringConfig = DEFAULT_CONFIG
): number {
  if (!config.solveCountScaling || solveCount <= 1) {
    return score;
  }
  
  // Logarithmic scaling
  const scalingFactor = Math.log10(solveCount + 1) / Math.log10(config.maxSolvesForScaling + 1);
  const scaledScore = score * (1 - scalingFactor * 0.5); // Max 50% reduction
  
  return Math.max(config.minimumScore, Math.round(scaledScore));
}

/**
 * Calculate leaderboard with tie resolution
 * Inspired by CTFd's leaderboard system
 */
export function calculateLeaderboard(
  solves: SolveRecord[],
  challengeStartTime: number,
  config: ScoringConfig = DEFAULT_CONFIG
): Array<ScoringResult & { userId: string; challengesSolved: number }> {
  // Group solves by user
  const userSolves = new Map<string, SolveRecord[]>();
  
  for (const solve of solves) {
    if (!userSolves.has(solve.userId)) {
      userSolves.set(solve.userId, []);
    }
    userSolves.get(solve.userId)!.push(solve);
  }
  
  // Calculate scores for each user
  const leaderboard: Array<ScoringResult & { userId: string; challengesSolved: number }> = [];
  
  for (const [userId, userSolveList] of userSolves) {
    let totalScore = 0;
    
    for (const solve of userSolveList) {
      const result = calculateScore(solve, challengeStartTime, config);
      totalScore += result.score;
    }
    
    leaderboard.push({
      score: totalScore,
      breakdown: { base: 0, timeBonus: 0, hintPenalty: 0, solveCountBonus: 0 },
      rank: 0,
      tiebreaker: userSolveList.map(s => generateTiebreaker(s)).join(','),
      userId,
      challengesSolved: userSolveList.length
    });
  }
  
  // Sort by score (descending), then by tiebreaker (ascending)
  leaderboard.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.tiebreaker.localeCompare(b.tiebreaker);
  });
  
  // Assign ranks
  for (let i = 0; i < leaderboard.length; i++) {
    leaderboard[i].rank = i + 1;
  }
  
  return leaderboard;
}

/**
 * Freeze leaderboard at a specific time
 * Inspired by CTFd's score freeze feature
 */
export function freezeLeaderboard(
  solves: SolveRecord[],
  freezeTime: number,
  challengeStartTime: number,
  config: ScoringConfig = DEFAULT_CONFIG
): Array<ScoringResult & { userId: string; challengesSolved: number }> {
  // Only include solves before freeze time
  const frozenSolves = solves.filter(s => s.timestamp <= freezeTime);
  
  return calculateLeaderboard(frozenSolves, challengeStartTime, config);
}

/**
 * Hide scores from public leaderboard
 * Inspired by CTFd's score visibility settings
 */
export function hideScores(
  leaderboard: Array<ScoringResult & { userId: string }>,
  hiddenUserIds: string[]
): Array<ScoringResult & { userId: string; hidden: boolean }> {
  return leaderboard.map(entry => ({
    ...entry,
    hidden: hiddenUserIds.includes(entry.userId)
  }));
}