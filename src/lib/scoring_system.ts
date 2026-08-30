/**
 * CTF Scoring System — Inspired by CTFd
 * Dynamic scoring, time bonuses, hint penalties, streak multipliers
 */

export interface ScoringConfig {
  basePoints: number;
  decayRate: number;
  minimumPoints: number;
  timeBonusEnabled: boolean;
  timeBonusMax: number;
  timeBonusDecayHours: number;
  hintPenaltyPercent: number;
  streakMultiplierEnabled: boolean;
  streakMultiplierMax: number;
  firstBloodBonus: number;
}

export interface SolveRecord {
  challengeId: string;
  userId: string;
  timestamp: number;
  points: number;
  hintsUsed: number;
  timeBonus: number;
  streakBonus: number;
  firstBlood: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  basePoints: number;
  currentPoints: number;
  solves: number;
  maxSolves: number;
  hints: Hint[];
  flag: string;
  createdAt: number;
}

export interface Hint {
  id: string;
  content: string;
  cost: number;
  order: number;
}

export interface Player {
  id: string;
  username: string;
  totalScore: number;
  solveCount: number;
  firstBloods: number;
  currentStreak: number;
  bestStreak: number;
  solves: SolveRecord[];
  joinDate: number;
}

export interface ScoreBreakdown {
  basePoints: number;
  decayReduction: number;
  currentPoints: number;
  timeBonus: number;
  hintPenalty: number;
  streakBonus: number;
  firstBloodBonus: number;
  totalPoints: number;
}

const DEFAULT_CONFIG: ScoringConfig = {
  basePoints: 500,
  decayRate: 0.05,
  minimumPoints: 50,
  timeBonusEnabled: true,
  timeBonusMax: 100,
  timeBonusDecayHours: 48,
  hintPenaltyPercent: 10,
  streakMultiplierEnabled: true,
  streakMultiplierMax: 1.5,
  firstBloodBonus: 50,
};

export function calculateDecayedPoints(
  basePoints: number,
  solves: number,
  decayRate: number,
  minimumPoints: number
): number {
  const decayed = basePoints * Math.exp(-decayRate * solves);
  return Math.max(minimumPoints, Math.round(decayed));
}

export function calculateTimeBonus(
  challengeCreated: number,
  solveTime: number,
  maxBonus: number,
  decayHours: number
): number {
  const elapsedHours = (solveTime - challengeCreated) / (1000 * 60 * 60);
  const bonus = maxBonus * Math.exp(-elapsedHours / decayHours);
  return Math.max(0, Math.round(bonus));
}

export function calculateHintPenalty(
  currentPoints: number,
  hintsUsed: number,
  penaltyPercent: number
): number {
  const totalPenalty = hintsUsed * (penaltyPercent / 100);
  return Math.round(currentPoints * totalPenalty);
}

export function calculateStreakBonus(
  currentStreak: number,
  multiplierMax: number
): number {
  if (currentStreak < 2) return 0;
  const multiplier = Math.min(1 + (currentStreak - 1) * 0.1, multiplierMax);
  return Math.round((multiplier - 1) * 100);
}

export function calculateScoreBreakdown(
  challenge: Challenge,
  solveTime: number,
  hintsUsed: number,
  currentStreak: number,
  isFirstBlood: boolean,
  config: ScoringConfig = DEFAULT_CONFIG
): ScoreBreakdown {
  const currentPoints = calculateDecayedPoints(
    challenge.basePoints,
    challenge.solves,
    config.decayRate,
    config.minimumPoints
  );
  const timeBonus = config.timeBonusEnabled
    ? calculateTimeBonus(challenge.createdAt, solveTime, config.timeBonusMax, config.timeBonusDecayHours)
    : 0;
  const hintPenalty = calculateHintPenalty(currentPoints, hintsUsed, config.hintPenaltyPercent);
  const streakBonus = config.streakMultiplierEnabled
    ? calculateStreakBonus(currentStreak, config.streakMultiplierMax)
    : 0;
  const firstBloodBonus = isFirstBlood ? config.firstBloodBonus : 0;
  const totalPoints = Math.max(0, currentPoints + timeBonus - hintPenalty + streakBonus + firstBloodBonus);
  return {
    basePoints: challenge.basePoints,
    decayReduction: challenge.basePoints - currentPoints,
    currentPoints,
    timeBonus,
    hintPenalty,
    streakBonus,
    firstBloodBonus,
    totalPoints: Math.round(totalPoints),
  };
}

export function determineDifficultyTier(points: number): string {
  if (points >= 400) return 'extreme';
  if (points >= 250) return 'hard';
  if (points >= 100) return 'medium';
  return 'easy';
}

export function calculateLeaderboard(
  players: Player[],
  sortBy: 'score' | 'solves' | 'streak' = 'score'
): Player[] {
  const sorted = [...players];
  switch (sortBy) {
    case 'score':
      sorted.sort((a, b) => b.totalScore - a.totalScore);
      break;
    case 'solves':
      sorted.sort((a, b) => b.solveCount - a.solveCount);
      break;
    case 'streak':
      sorted.sort((a, b) => b.currentStreak - a.currentStreak);
      break;
  }
  return sorted;
}

export function calculateTeamScore(
  teamMembers: Player[],
  challenges: Challenge[]
): { totalScore: number; solveCount: number; uniqueChallenges: number } {
  const challengeScores = new Map<string, number>();
  for (const member of teamMembers) {
    for (const solve of member.solves) {
      const existing = challengeScores.get(solve.challengeId) || 0;
      challengeScores.set(solve.challengeId, Math.max(existing, solve.points));
    }
  }
  const totalScore = Array.from(challengeScores.values()).reduce((a, b) => a + b, 0);
  return {
    totalScore,
    solveCount: teamMembers.reduce((a, b) => a + b.solveCount, 0),
    uniqueChallenges: challengeScores.size,
  };
}

export function getScoreColor(score: number): string {
  if (score >= 400) return '#9333ea';
  if (score >= 250) return '#ef4444';
  if (score >= 100) return '#f59e0b';
  return '#22c55e';
}

export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
    extreme: 'Extreme',
  };
  return labels[difficulty] || difficulty;
}
