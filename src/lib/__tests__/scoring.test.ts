import { describe, it, expect } from 'vitest';
import {
  processSolveEvent,
  getScoreboardState,
  formatSSEPayload,
  type SolveEvent,
} from '../../lib/live_scoreboard';
import {
  calculateDynamicPoints,
  analyzeTeamPerformance,
  getRecommendations,
  rankTeams,
  areHintsAvailable,
} from '../../lib/adaptive_difficulty';

function makeSolveEvent(overrides: Partial<SolveEvent> = {}): SolveEvent {
  return {
    type: 'solve',
    teamId: 'team-1',
    teamName: 'HackerOne',
    challengeId: 'chal-1',
    challengeName: 'SQL Injection',
    points: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('live_scoreboard', () => {
  it('processSolveEvent returns badgesAwarded array', () => {
    const result = processSolveEvent(makeSolveEvent());
    expect(result).toHaveProperty('badgesAwarded');
    expect(Array.isArray(result.badgesAwarded)).toBe(true);
  });

  it('awards first_blood on first solve', () => {
    const uniqueTeam = `team-${Date.now()}-${Math.random()}`;
    const result = processSolveEvent(makeSolveEvent({ teamId: uniqueTeam, teamName: 'NewTeam', challengeId: 'unique-chal' }));
    expect(result.badgesAwarded).toContain('first_blood');
  });

  it('getScoreboardState returns entries and events', () => {
    const state = getScoreboardState();
    expect(state).toHaveProperty('entries');
    expect(state).toHaveProperty('events');
    expect(state).toHaveProperty('lastUpdate');
    expect(Array.isArray(state.entries)).toBe(true);
    expect(Array.isArray(state.events)).toBe(true);
  });

  it('formatSSEPayload returns JSON string with expected keys', () => {
    const state = getScoreboardState();
    const payload = formatSSEPayload(state);
    const parsed = JSON.parse(payload);
    expect(parsed).toHaveProperty('top10');
    expect(parsed).toHaveProperty('recentEvents');
    expect(parsed).toHaveProperty('lastUpdate');
  });
});

describe('adaptive_difficulty', () => {
  it('calculateDynamicPoints returns base points for zero solves', () => {
    const points = calculateDynamicPoints(100, 20, 0);
    expect(points).toBe(100);
  });

  it('points decrease as solve rate increases', () => {
    const low = calculateDynamicPoints(100, 20, 2);   // 10% solve rate
    const mid = calculateDynamicPoints(100, 20, 10);  // 50% solve rate
    const high = calculateDynamicPoints(100, 20, 18); // 90% solve rate
    expect(low).toBeGreaterThanOrEqual(mid);
    expect(mid).toBeGreaterThanOrEqual(high);
  });

  it('points stay within min/max bounds', () => {
    for (let i = 0; i < 20; i++) {
      const points = calculateDynamicPoints(100, 20, i);
      expect(points).toBeGreaterThanOrEqual(50);
      expect(points).toBeLessThanOrEqual(500);
    }
  });

  it('areHintsAvailable returns false when elapsed time is short', () => {
    const challengeStart = Date.now() - 60_000; // 1 minute ago
    expect(areHintsAvailable(challengeStart, 30)).toBe(false);
  });

  it('areHintsAvailable returns true after unlock period', () => {
    const challengeStart = Date.now() - 60 * 60_000; // 60 minutes ago
    expect(areHintsAvailable(challengeStart, 30)).toBe(true);
  });

  it('analyzeTeamPerformance returns correct shape', () => {
    const perf = analyzeTeamPerformance(
      [
        { challengeId: 'c1', category: 'web', timeMinutes: 5, points: 100 },
        { challengeId: 'c2', category: 'crypto', timeMinutes: 10, points: 200 },
      ],
      'team-1'
    );
    expect(perf).toHaveProperty('teamId', 'team-1');
    expect(perf).toHaveProperty('totalSolves', 2);
    expect(perf).toHaveProperty('averageTime');
    expect(perf).toHaveProperty('categoryStrengths');
  });

  it('rankTeams sorts by score descending', () => {
    const ranked = rankTeams([
      { teamId: 'a', score: 100, solves: 5, lastSolveTime: 100, accuracy: 0.9 },
      { teamId: 'b', score: 200, solves: 8, lastSolveTime: 50, accuracy: 0.95 },
      { teamId: 'c', score: 150, solves: 6, lastSolveTime: 80, accuracy: 0.85 },
    ]);
    expect(ranked[0].teamId).toBe('b');
    expect(ranked[1].teamId).toBe('c');
    expect(ranked[2].teamId).toBe('a');
    expect(ranked[0].rank).toBe(1);
  });
});
