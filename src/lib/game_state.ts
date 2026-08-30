/**
 * CTF Game State Management
 *
 * Extracted from a1ctf (inspiration).
 * Manages game status, team participation, and real-time updates.
 */

// --- Types ---

export enum GameStatus {
  NoSuchGame = 'NoSuchGame',
  Pending = 'Pending',
  Running = 'Running',
  Ended = 'Ended',
  PracticeMode = 'PracticeMode',
}

export enum ParticipationStatus {
  UnLogin = 'UnLogin',
  NotJoined = 'NotJoined',
  Joined = 'Joined',
  Banned = 'Banned',
}

export interface GameInfo {
  gameId: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  practiceMode: boolean;
  teamStatus: ParticipationStatus;
  maxTeams: number;
  currentTeams: number;
  flagFormat: string;
  hintCost: number;
}

export interface TeamInfo {
  teamId: number;
  name: string;
  members: string[];
  score: number;
  solves: number;
  rank: number;
}

export interface GameState {
  gameInfo: GameInfo | null;
  gameStatus: GameStatus;
  teamStatus: ParticipationStatus;
  isLoading: boolean;
  error: string | null;
}

// --- Game Status ---

export function getGameStatus(gameInfo: GameInfo): GameStatus {
  if (!gameInfo) return GameStatus.NoSuchGame;

  const now = new Date();
  const start = new Date(gameInfo.startTime);
  const end = new Date(gameInfo.endTime);

  if (now < start) {
    return GameStatus.Pending;
  } else if (now >= start && now < end) {
    return GameStatus.Running;
  } else if (now >= end) {
    if (gameInfo.practiceMode) {
      return GameStatus.PracticeMode;
    }
    return GameStatus.Ended;
  }

  return GameStatus.NoSuchGame;
}

export function getRemainingTime(gameInfo: GameInfo): number {
  if (!gameInfo) return 0;

  const now = new Date();
  const end = new Date(gameInfo.endTime);

  return Math.max(0, end.getTime() - now.getTime());
}

export function getRemainingTimeFormatted(gameInfo: GameInfo): string {
  const ms = getRemainingTime(gameInfo);
  if (ms === 0) return 'Ended';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

// --- Participation ---

export function canJoinGame(gameInfo: GameInfo): boolean {
  if (!gameInfo) return false;
  if (gameInfo.teamStatus !== ParticipationStatus.NotJoined) return false;
  if (gameInfo.currentTeams >= gameInfo.maxTeams) return false;

  const status = getGameStatus(gameInfo);
  return status === GameStatus.Pending || status === GameStatus.Running;
}

export function canSubmitFlags(gameInfo: GameInfo): boolean {
  if (!gameInfo) return false;

  const status = getGameStatus(gameInfo);
  return status === GameStatus.Running || status === GameStatus.PracticeMode;
}

export function canViewHints(gameInfo: GameInfo): boolean {
  return canSubmitFlags(gameInfo);
}

// --- Scoring ---

export function calculateScore(
  basePoints: number,
  solveTime: Date,
  gameStartTime: Date,
  gameEndTime: Date,
  hintsUsed: number,
  hintCost: number = 50,
): number {
  // Base score minus hint penalty
  let score = Math.max(0, basePoints - hintsUsed * hintCost);

  // Time bonus: earlier solves get more points
  const totalDuration = gameEndTime.getTime() - gameStartTime.getTime();
  const solveDuration = solveTime.getTime() - gameStartTime.getTime();
  const timeFactor = 1 - (solveDuration / totalDuration) * 0.3; // Up to 30% time bonus

  score = Math.round(score * Math.max(0.7, timeFactor));

  return score;
}

export function getScoreColor(score: number): string {
  if (score >= 500) return '#22c55e'; // green
  if (score >= 300) return '#3b82f6'; // blue
  if (score >= 100) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

export function getDifficultyColor(difficulty: string): string {
  switch (difficulty.toLowerCase()) {
    case 'easy': return '#22c55e';
    case 'medium': return '#f59e0b';
    case 'hard': return '#ef4444';
    case 'extreme': return '#a855f7';
    default: return '#6b7280';
  }
}

// --- Leaderboard ---

export function calculateLeaderboard(
  teams: TeamInfo[],
): TeamInfo[] {
  return [...teams]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.solves !== a.solves) return b.solves - a.solves;
      return a.teamId - b.teamId;
    })
    .map((team, index) => ({
      ...team,
      rank: index + 1,
    }));
}

export function getRankSuffix(rank: number): string {
  if (rank === 1) return 'st';
  if (rank === 2) return 'nd';
  if (rank === 3) return 'rd';
  return 'th';
}

// --- Validation ---

export function validateTeamName(name: string): { valid: boolean; error?: string } {
  if (name.length < 3) {
    return { valid: false, error: 'Team name must be at least 3 characters' };
  }
  if (name.length > 30) {
    return { valid: false, error: 'Team name must be at most 30 characters' };
  }
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    return { valid: false, error: 'Team name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }
  return { valid: true };
}

export function validateInviteCode(code: string): { valid: boolean; error?: string } {
  if (code.length !== 6) {
    return { valid: false, error: 'Invite code must be 6 characters' };
  }
  if (!/^[A-Za-z0-9]+$/.test(code)) {
    return { valid: false, error: 'Invite code must be alphanumeric' };
  }
  return { valid: true };
}
