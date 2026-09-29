/**
 * Tests for leaderboard.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  detectAchievements,
  generatePlayerLeaderboard,
  generateTeamLeaderboard,
  generateCategoryLeaderboard,
  generateFullLeaderboard,
  calculateRankChanges,
  AchievementType,
  type Solve,
  type PlayerEntry,
} from '../../src/lib/leaderboard';

function makeSolve(overrides: Partial<Solve> = {}): Solve {
  return {
    challenge_id: 'ch1',
    challenge_title: 'Test Challenge',
    category: 'crypto',
    difficulty: 'easy',
    points: 100,
    solved_at: '2024-01-15T10:00:00Z',
    hints_used: 0,
    time_to_solve: 60,
    username: 'player1',
    ...overrides,
  };
}

describe('calculateStreak', () => {
  it('returns 0 for empty dates', () => {
    expect(calculateStreak([])).toBe(0);
  });

  it('detects single day streak', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(calculateStreak([today])).toBe(1);
  });

  it('detects multi-day streak', () => {
    const dates = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10) + 'T10:00:00Z');
    }
    expect(calculateStreak(dates)).toBe(5);
  });

  it('breaks streak on gap', () => {
    const today = new Date();
    const dates = [
      today.toISOString().slice(0, 10) + 'T10:00:00Z',
      new Date(today.getTime() - 4 * 86400000).toISOString().slice(0, 10) + 'T10:00:00Z',
    ];
    expect(calculateStreak(dates)).toBe(1);
  });
});

describe('detectAchievements', () => {
  it('detects hintless achievement', () => {
    const solves = Array.from({ length: 5 }, (_, i) =>
      makeSolve({ challenge_id: `ch${i}`, hints_used: 0 })
    );
    const achievements = detectAchievements(solves, solves, {});
    expect(achievements).toContain(AchievementType.HINTLESS);
  });

  it('detects versatile achievement', () => {
    const solves = [
      makeSolve({ category: 'crypto' }),
      makeSolve({ category: 'web' }),
      makeSolve({ category: 'pwn' }),
    ];
    const achievements = detectAchievements(solves, solves, {});
    expect(achievements).toContain(AchievementType.VERSATILE);
  });

  it('detects speed demon', () => {
    const solves = [makeSolve({ time_to_solve: 120 })];
    const achievements = detectAchievements(solves, solves, {});
    expect(achievements).toContain(AchievementType.SPEED_DEMON);
  });

  it('detects first blood', () => {
    const solves = [makeSolve({ username: 'alice' })];
    const achievements = detectAchievements(solves, solves, {});
    expect(achievements).toContain(AchievementType.FIRST_BLOOD);
  });

  it('returns empty for no solves', () => {
    expect(detectAchievements([], [], {})).toEqual([]);
  });
});

describe('generatePlayerLeaderboard', () => {
  it('ranks by score', () => {
    const solves = [
      makeSolve({ username: 'alice', points: 200 }),
      makeSolve({ username: 'bob', points: 300 }),
      makeSolve({ username: 'charlie', points: 100 }),
    ];
    const board = generatePlayerLeaderboard(solves);
    expect(board[0].username).toBe('bob');
    expect(board[0].rank).toBe(1);
    expect(board[0].score).toBe(300);
  });

  it('handles empty solves', () => {
    expect(generatePlayerLeaderboard([])).toEqual([]);
  });

  it('counts solves correctly', () => {
    const solves = [
      makeSolve({ username: 'alice', challenge_id: 'ch1' }),
      makeSolve({ username: 'alice', challenge_id: 'ch2' }),
      makeSolve({ username: 'bob', challenge_id: 'ch1' }),
    ];
    const board = generatePlayerLeaderboard(solves);
    const alice = board.find(e => e.username === 'alice');
    expect(alice?.solves).toBe(2);
  });
});

describe('generateTeamLeaderboard', () => {
  it('ranks teams by score', () => {
    const solves = [
      makeSolve({ username: 'alice', points: 200, challenge_id: 'ch1' }),
      makeSolve({ username: 'bob', points: 300, challenge_id: 'ch2' }),
      makeSolve({ username: 'charlie', points: 100, challenge_id: 'ch3' }),
    ];
    const teams = { teamA: ['alice', 'bob'], teamB: ['charlie'] };
    const board = generateTeamLeaderboard(solves, teams);
    expect(board[0].team_name).toBe('teamA');
    expect(board[0].total_score).toBe(500);
  });

  it('deduplicates challenge scores', () => {
    const solves = [
      makeSolve({ username: 'alice', points: 200, challenge_id: 'ch1' }),
      makeSolve({ username: 'bob', points: 150, challenge_id: 'ch1' }),
    ];
    const teams = { teamA: ['alice', 'bob'] };
    const board = generateTeamLeaderboard(solves, teams);
    expect(board[0].total_score).toBe(200);
  });
});

describe('generateCategoryLeaderboard', () => {
  it('groups by category', () => {
    const solves = [
      makeSolve({ category: 'crypto', points: 100 }),
      makeSolve({ category: 'crypto', points: 200 }),
      makeSolve({ category: 'web', points: 150 }),
    ];
    const board = generateCategoryLeaderboard(solves);
    expect(board.length).toBe(2);
    expect(board[0].category).toBe('crypto');
    expect(board[0].total_solves).toBe(2);
  });
});

describe('generateFullLeaderboard', () => {
  it('combines all views', () => {
    const solves = [
      makeSolve({ username: 'alice', points: 200, challenge_id: 'ch1' }),
      makeSolve({ username: 'bob', points: 300, challenge_id: 'ch2' }),
    ];
    const teams = { teamA: ['alice'], teamB: ['bob'] };
    const board = generateFullLeaderboard(solves, teams);
    expect(board.total_players).toBe(2);
    expect(board.total_teams).toBe(2);
    expect(board.entries.length).toBe(2);
    expect(board.teams.length).toBe(2);
  });
});

describe('calculateRankChanges', () => {
  it('detects rank improvement', () => {
    const previous: PlayerEntry[] = [
      { rank: 2, username: 'alice', team: '', score: 200, solves: 2, last_solve: '', streak: 0, achievements: [], rank_change: 0 },
      { rank: 1, username: 'bob', team: '', score: 300, solves: 3, last_solve: '', streak: 0, achievements: [], rank_change: 0 },
    ];
    const current: PlayerEntry[] = [
      { rank: 1, username: 'alice', team: '', score: 400, solves: 4, last_solve: '', streak: 0, achievements: [], rank_change: 0 },
      { rank: 2, username: 'bob', team: '', score: 300, solves: 3, last_solve: '', streak: 0, achievements: [], rank_change: 0 },
    ];
    const updated = calculateRankChanges(current, previous);
    expect(updated[0].rank_change).toBe(1);
    expect(updated[1].rank_change).toBe(-1);
  });
});
