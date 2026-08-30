/**
 * Advanced CTF Scoring Algorithms
 * Extracted from: scoring-playground (Defcon CTF scoring simulator)
 * Patterns: Log decay, parabolic decay, exponential decay, linear decay,
 *           five-tier, time-based, first blood bonuses, tie-breakers
 */

export interface Challenge {
  id: string;
  name: string;
  openTime: number; // minutes from game start
  solvedBy: SolveRecord[];
}

export interface SolveRecord {
  teamId: string;
  time: number; // minutes from challenge open
  order: number; // 1-based solve order
  isFirstBlood: boolean;
}

export interface Team {
  id: string;
  name: string;
  solves: TeamSolve[];
  bonus: number;
}

export interface TeamSolve {
  challengeId: string;
  points: number;
  time: number;
  isFirstBlood: boolean;
}

export interface ScoringResult {
  challengeScores: Map<string, number>;
  teamScores: Map<string, number>;
  rankings: RankEntry[];
}

export interface RankEntry {
  rank: number;
  teamId: string;
  teamName: string;
  score: number;
  solves: number;
  firstBloods: number;
}

// ─── Scoring Functions ─────────────────────────────────────────────────

/**
 * OOO Log Decay (Defcon 2018-2020)
 * Points: base + (top - base) / (1 + k * Solved(time) * log(j * Solved(time)))
 */
export function scoreOOO(
  base: number = 100,
  top: number = 500,
  k: number = 0.08,
  j: number = 1,
  time: number = 2880,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const n = chall.solvedBy.filter((s) => s.time < time).length;
    if (n === 0) return top;
    return Math.floor(base + (top - base) / (1 + k * n * Math.log(j * n)));
  };
}

/**
 * CTFd Parabolic Decay
 * Points: max(base, ((base - top) / decay²) * Solved² + top)
 */
export function scoreCTFd(
  base: number = 100,
  top: number = 500,
  decay: number = 20,
  time: number = 2880,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const n = chall.solvedBy.filter((s) => s.time < time).length;
    const score = ((base - top) / (decay * decay)) * (n * n) + top;
    return Math.max(base, Math.ceil(score));
  };
}

/**
 * CCC Exponential Decay
 * Points: base + (top - base) / (1 + ((max(0, Solved-1)) / k) ^ j)
 */
export function scoreCCC(
  base: number = 30,
  top: number = 500,
  k: number = 11.92201,
  j: number = 1.206069,
  time: number = 2880,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const n = chall.solvedBy.filter((s) => s.time < time).length;
    const x = Math.max(0, n - 1);
    return Math.round(base + (top - base) / (1 + Math.pow(x / k, j)));
  };
}

/**
 * Linear Decay
 * Points: max(base, top - step * Solved)
 */
export function scoreLinear(
  base: number = 100,
  top: number = 500,
  step: number = 8,
  time: number = 2880,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const n = chall.solvedBy.filter((s) => s.time < time).length;
    const p = top - step * n;
    return Math.max(base, p);
  };
}

/**
 * Five-Tier Fixed Levels
 * Classic 500/400/300/200/100 based on solve count thresholds
 */
export function scoreFiveTier(
  thresholds: [number, number, number, number] = [10, 15, 20, 40],
  time: number = 2880,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const n = chall.solvedBy.filter((s) => s.time < time).length;
    if (n <= thresholds[0]) return 500;
    if (n <= thresholds[1]) return 400;
    if (n <= thresholds[2]) return 300;
    if (n <= thresholds[3]) return 200;
    return 100;
  };
}

/**
 * Time-Based Incremental
 * Points increase over time until solved (rewards faster teams)
 */
export function scoreTimeBased(
  base: number = 30,
  top: number = 500,
  incrementPerMinute: number = 0.75,
  maxSolvers: number = 1,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const firstSolve = chall.solvedBy.find((s) => s.order <= maxSolvers);
    if (firstSolve) {
      return Math.round(Math.min(top, base + firstSolve.time / incrementPerMinute));
    }
    return top;
  };
}

// ─── Bonus Functions ───────────────────────────────────────────────────

export function firstBloodBonus(
  bonuses: (number | string)[] = [30, 20, 10],
): (team: Team, chall: Challenge) => number {
  return (team: Team, chall: Challenge) => {
    const solve = team.solves.find((s) => s.challengeId === chall.id);
    if (!solve || !solve.isFirstBlood) return 0;
    const idx = chall.solvedBy.findIndex((s) => s.teamId === team.id);
    if (idx < bonuses.length) {
      const bonus = bonuses[idx];
      if (typeof bonus === "string" && bonus.endsWith("%")) {
        const pct = parseFloat(bonus) / 100;
        return Math.round(pct * solve.points);
      }
      return bonus as number;
    }
    return 0;
  };
}

// ─── Tie-Breakers ──────────────────────────────────────────────────────

export type TieBreaker = (team: Team) => number;

export const tieBreakers = {
  byScore: ((team: Team) => team.solves.reduce((sum, s) => sum + s.points, 0) + team.bonus) as TieBreaker,
  bySolves: ((team: Team) => team.solves.length) as TieBreaker,
  byFirstBloods: ((team: Team) => team.solves.filter((s) => s.isFirstBlood).length) as TieBreaker,
  byEarliestFinish: ((team: Team) => {
    const lastSolve = team.solves.reduce((latest, s) => Math.max(latest, s.time), 0);
    return lastSolve > 0 ? 1 / lastSolve : 0;
  }) as TieBreaker,
  byCumulativeTime: ((team: Team) => {
    const total = team.solves.reduce((sum, s) => sum + s.time, 0);
    return total > 0 ? 1 / total : 0;
  }) as TieBreaker,
};

// ─── Scoreboard Engine ─────────────────────────────────────────────────

export function calculateScoreboard(
  challenges: Challenge[],
  teams: Team[],
  scoringFn: (chall: Challenge) => number,
  tieBreaker: TieBreaker = tieBreakers.byScore,
  bonusFn?: (team: Team, chall: Challenge) => number,
): ScoringResult {
  const challengeScores = new Map<string, number>();
  const teamScores = new Map<string, number>();

  // Calculate challenge scores
  for (const chall of challenges) {
    challengeScores.set(chall.id, scoringFn(chall));
  }

  // Calculate team scores
  for (const team of teams) {
    let totalScore = team.bonus;
    for (const solve of team.solves) {
      const points = challengeScores.get(solve.challengeId) || 0;
      totalScore += points;
      if (bonusFn) {
        const chall = challenges.find((c) => c.id === solve.challengeId);
        if (chall) totalScore += bonusFn(team, chall);
      }
    }
    teamScores.set(team.id, totalScore);
  }

  // Rank teams
  const rankings: RankEntry[] = teams
    .map((team) => ({
      rank: 0,
      teamId: team.id,
      teamName: team.name,
      score: teamScores.get(team.id) || 0,
      solves: team.solves.length,
      firstBloods: team.solves.filter((s) => s.isFirstBlood).length,
    }))
    .sort((a, b) => {
      const tie = tieBreaker(
        teams.find((t) => t.id === a.teamId)!,
      ) - tieBreaker(
        teams.find((t) => t.id === b.teamId)!,
      );
      return tie !== 0 ? -tie : b.score - a.score;
    })
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return { challengeScores, teamScores, rankings };
}

// ─── Dynamic Score Adjustment ──────────────────────────────────────────

export function adaptiveScoring(
  challenges: Challenge[],
  targetSolveRate: number = 0.6,
): (chall: Challenge) => number {
  return (chall: Challenge) => {
    const solveRate = chall.solvedBy.length / Math.max(1, chall.solvedBy.length + 5);
    const difficulty = 1.0 - solveRate;
    const baseScore = 100;
    const topScore = 500;
    const adjusted = baseScore + (topScore - baseScore) * difficulty;
    return Math.round(Math.max(baseScore, Math.min(topScore, adjusted)));
  };
}
