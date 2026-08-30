import { describe, it, expect } from 'vitest';
import {
  GameStatus,
  ParticipationStatus,
  getGameStatus,
  getRemainingTime,
  getRemainingTimeFormatted,
  canJoinGame,
  canSubmitFlags,
  calculateScore,
  getScoreColor,
  getDifficultyColor,
  calculateLeaderboard,
  getRankSuffix,
  validateTeamName,
  validateInviteCode,
} from '../../src/lib/game_state';
import type { GameInfo, TeamInfo } from '../../src/lib/game_state';

const makeGame = (overrides: Partial<GameInfo> = {}): GameInfo => ({
  gameId: 1,
  title: 'Test CTF',
  description: 'A test CTF',
  startTime: new Date(Date.now() - 86400000).toISOString(),
  endTime: new Date(Date.now() + 86400000).toISOString(),
  practiceMode: false,
  teamStatus: ParticipationStatus.NotJoined,
  maxTeams: 100,
  currentTeams: 10,
  flagFormat: 'flag{...}',
  hintCost: 50,
  ...overrides,
});

describe('Game State', () => {
  describe('getGameStatus', () => {
    it('returns Running for active game', () => {
      const game = makeGame();
      expect(getGameStatus(game)).toBe(GameStatus.Running);
    });

    it('returns Pending for future game', () => {
      const game = makeGame({
        startTime: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(getGameStatus(game)).toBe(GameStatus.Pending);
    });

    it('returns Ended for past game', () => {
      const game = makeGame({
        endTime: new Date(Date.now() - 86400000).toISOString(),
      });
      expect(getGameStatus(game)).toBe(GameStatus.Ended);
    });

    it('returns PracticeMode for practice game', () => {
      const game = makeGame({
        endTime: new Date(Date.now() - 86400000).toISOString(),
        practiceMode: true,
      });
      expect(getGameStatus(game)).toBe(GameStatus.PracticeMode);
    });

    it('returns NoSuchGame for null', () => {
      expect(getGameStatus(null as any)).toBe(GameStatus.NoSuchGame);
    });
  });

  describe('Time', () => {
    it('getRemainingTime returns positive for active game', () => {
      const game = makeGame();
      expect(getRemainingTime(game)).toBeGreaterThan(0);
    });

    it('getRemainingTimeFormatted formats correctly', () => {
      const game = makeGame();
      const formatted = getRemainingTimeFormatted(game);
      expect(formatted).toMatch(/\d+[hm]\s*\d+[ms]/);
    });
  });

  describe('Participation', () => {
    it('can join when not joined and slots available', () => {
      const game = makeGame();
      expect(canJoinGame(game)).toBe(true);
    });

    it('cannot join when full', () => {
      const game = makeGame({ currentTeams: 100, maxTeams: 100 });
      expect(canJoinGame(game)).toBe(false);
    });

    it('can submit flags when running', () => {
      const game = makeGame();
      expect(canSubmitFlags(game)).toBe(true);
    });
  });

  describe('Scoring', () => {
    it('calculate score with hints', () => {
      const start = new Date(Date.now() - 86400000);
      const end = new Date(Date.now() + 86400000);
      const solve = new Date();
      const score = calculateScore(500, solve, start, end, 2, 50);
      expect(score).toBeLessThan(500);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('Colors', () => {
    it('getScoreColor returns correct colors', () => {
      expect(getScoreColor(600)).toBe('#22c55e');
      expect(getScoreColor(400)).toBe('#3b82f6');
      expect(getScoreColor(200)).toBe('#f59e0b');
      expect(getScoreColor(50)).toBe('#ef4444');
    });

    it('getDifficultyColor returns correct colors', () => {
      expect(getDifficultyColor('easy')).toBe('#22c55e');
      expect(getDifficultyColor('medium')).toBe('#f59e0b');
      expect(getDifficultyColor('hard')).toBe('#ef4444');
      expect(getDifficultyColor('extreme')).toBe('#a855f7');
    });
  });

  describe('Leaderboard', () => {
    it('sorts by score', () => {
      const teams: TeamInfo[] = [
        { teamId: 1, name: 'Alpha', members: [], score: 100, solves: 5, rank: 0 },
        { teamId: 2, name: 'Beta', members: [], score: 200, solves: 3, rank: 0 },
      ];
      const ranked = calculateLeaderboard(teams);
      expect(ranked[0].name).toBe('Beta');
      expect(ranked[0].rank).toBe(1);
    });
  });

  describe('Rank Suffix', () => {
    it('returns correct suffixes', () => {
      expect(getRankSuffix(1)).toBe('st');
      expect(getRankSuffix(2)).toBe('nd');
      expect(getRankSuffix(3)).toBe('rd');
      expect(getRankSuffix(4)).toBe('th');
    });
  });

  describe('Validation', () => {
    it('validates team name', () => {
      expect(validateTeamName('ab').valid).toBe(false);
      expect(validateTeamName('Alpha Team').valid).toBe(true);
      expect(validateTeamName('a'.repeat(31)).valid).toBe(false);
    });

    it('validates invite code', () => {
      expect(validateInviteCode('abc').valid).toBe(false);
      expect(validateInviteCode('ABC123').valid).toBe(true);
    });
  });
});
